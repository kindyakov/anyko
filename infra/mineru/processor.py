"""Anyko stateless MinerU SDK boundary. No Tasks/FileStore/document-library cache."""
import asyncio
from contextlib import asynccontextmanager
from hashlib import sha256
import io
from importlib.metadata import version
import logging
import os
from pathlib import Path, PurePosixPath
import shutil
import tempfile
import uuid
import zipfile


CONTAINER_IMAGES = {'avif': 'AVIF', 'heif': 'HEIF'}
RASTER_FORMATS = {'jpg', 'png', 'webp', 'tiff', *CONTAINER_IMAGES}
MAX_IMAGES = 256
REPORTED_ERRORS = {
    'TOO_MANY_EXPORTED_IMAGES',
    'DOCUMENT_VISUALS_TOO_LARGE',
    'UNSUPPORTED_DOCUMENT_VISUAL',
    'IMAGE_TOO_LARGE',
    'EXPORT_TOO_LARGE',
    'PDF_OCR_NO_READABLE_TEXT',
}


def primary_image_png(data, extension):
    from PIL import Image, ImageOps

    if extension == 'heif':
        from pillow_heif import register_heif_opener
        register_heif_opener(decode_threads=2)
    with Image.open(io.BytesIO(data), formats=[CONTAINER_IMAGES[extension]]) as image:
        if image.width * image.height > 25_000_000:
            raise ValueError('IMAGE_TOO_LARGE')
        frame = ImageOps.exif_transpose(image).convert('RGBA')
        frame.thumbnail((2600, 2600))
        background = Image.new('RGB', frame.size, 'white')
        background.paste(frame, mask=frame.getchannel('A'))
        output = io.BytesIO()
        background.save(output, format='PNG')
        return output.getvalue()


def visual_inputs(writer, data, extension, recognize=None):
    """Explicit visual inputs, independent of the SDK's optional image export."""
    from PIL import Image, ImageOps, ImageSequence

    frames = []
    seen = set()

    def fingerprint(image):
        return image.size, sha256(image.convert('RGBA').tobytes()).digest()

    def add(name, payload):
        with Image.open(io.BytesIO(payload)) as image:
            if image.width * image.height > 25_000_000:
                raise ValueError('IMAGE_TOO_LARGE')
            if getattr(image, 'n_frames', 1) > MAX_IMAGES:
                raise ValueError('TOO_MANY_EXPORTED_IMAGES')
            for index, frame in enumerate(ImageSequence.Iterator(image)):
                if frame.width * frame.height > 25_000_000:
                    raise ValueError('IMAGE_TOO_LARGE')
                oriented = ImageOps.exif_transpose(frame)
                if extension == 'docx':
                    identity = fingerprint(oriented)
                    if identity in seen:
                        continue
                    seen.add(identity)
                normalized = oriented.convert('RGB')
                if recognize is not None:
                    if 'A' in oriented.getbands() or 'transparency' in oriented.info:
                        transparent = oriented.convert('RGBA')
                        background = Image.new('RGB', transparent.size, 'white')
                        background.paste(transparent, mask=transparent.getchannel('A'))
                        normalized = background
                    normalized.thumbnail((2600, 2600))
                    frames.append(recognize(normalized))
                normalized.thumbnail((2400, 2400))
                output = io.BytesIO()
                normalized.save(output, format='JPEG', quality=88)
                writer.write(f'{name}-{index:03d}.jpg', output.getvalue())

    if extension in RASTER_FORMATS:
        add('images/anyko-source', data)
    elif extension == 'docx':
        from docx_media import media_entries

        # Keep the SDK assets referenced in Markdown and only supplement missing media.
        for path, payload in writer.files.items():
            if path.startswith('images/') and PurePosixPath(path).suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'}:
                with Image.open(io.BytesIO(payload)) as image:
                    if image.width * image.height > 25_000_000:
                        raise ValueError('IMAGE_TOO_LARGE')
                    seen.add(fingerprint(ImageOps.exif_transpose(image)))
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            media = media_entries(archive.infolist(), MAX_IMAGES)
            for index, entry in enumerate(media):
                if PurePosixPath(entry.filename).suffix.lower() not in {'.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.gif', '.bmp'}:
                    raise ValueError('UNSUPPORTED_DOCUMENT_VISUAL')
                add(f'images/docx-media-{index:03d}', archive.read(entry))
    return frames

from fastapi import FastAPI, HTTPException, Request, Response

logger = logging.getLogger('uvicorn.error')


class ZipWriter:
    def __init__(self):
        self.files = {}
        self.size = 0
        self.image_count = 0

    def write(self, path, data):
        name = PurePosixPath(path)
        if name.is_absolute() or '..' in name.parts or '\\' in path:
            raise ValueError('INVALID_EXPORT_PATH')
        if path not in {'markdown.md', 'pdf-ocr.json'} and not path.startswith('images/'):
            return
        if path == 'pdf-ocr.json' and len(data) > 2 * 1024 * 1024:
            raise ValueError('EXPORT_TOO_LARGE')
        self.size += len(data)
        if self.size > 13 * 1024 * 1024 or path in self.files:
            raise ValueError('EXPORT_TOO_LARGE')
        if path.startswith('images/'):
            if self.image_count >= MAX_IMAGES:
                raise ValueError('TOO_MANY_EXPORTED_IMAGES')
            self.image_count += 1
        self.files[path] = data

    def write_string(self, path, data):
        self.write(path, data.encode('utf-8'))

    def replace_markdown(self, content):
        self.size -= len(self.files.pop('markdown.md'))
        self.write_string('markdown.md', content)

    def archive(self):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED) as archive:
            for path, data in self.files.items():
                archive.writestr(path, data)
        data = stream.getvalue()
        if len(data) > 10 * 1024 * 1024:
            raise ValueError('EXPORT_TOO_LARGE')
        return data


class Processor:
    def __init__(self, root, parse=None):
        self.root = Path(root).resolve()
        self.jobs = self.root / 'jobs'
        self.cancelled = self.root / 'cancelled'
        self.active = {}
        self.guard = asyncio.Lock()
        self.capacity = asyncio.Semaphore(1)
        self.parse = parse
        self.lock = None

    def job_dir(self, identity):
        if str(uuid.UUID(identity)) != identity:
            raise ValueError('INVALID_ATTEMPT_ID')
        path = self.jobs / identity
        if path.is_symlink() or path.resolve().parent != self.jobs.resolve():
            raise ValueError('UNSAFE_JOB_DIRECTORY')
        return path

    def erase_dir(self, identity):
        path = self.job_dir(identity)
        if path.exists():
            shutil.rmtree(path)
        if path.exists():
            raise RuntimeError('ERASURE_INCOMPLETE')

    def start(self):
        for directory in (self.jobs, self.cancelled):
            if directory.is_symlink() or directory.resolve() != directory:
                raise RuntimeError('UNSAFE_PROCESSOR_DIRECTORY')
        self.jobs.mkdir(parents=True, exist_ok=True)
        self.cancelled.mkdir(parents=True, exist_ok=True)
        self.lock = open(self.root / 'service.lock', 'a+b')
        self.lock.seek(0)
        self.lock.write(b'0')
        self.lock.flush()
        self.lock.seek(0)
        if os.name == 'nt':
            import msvcrt
            msvcrt.locking(self.lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(self.lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        # The process lock proves a former service cannot still write these jobs.
        for path in self.jobs.iterdir():
            self.erase_dir(path.name)

    async def run(self, identity, data, extension):
        path = self.job_dir(identity)
        path.mkdir()
        try:
            source = path / ('source.' + extension)
            source.write_bytes(data)
            async with self.capacity:
                temporary = path / 'temp'
                temporary.mkdir()
                previous = {key: os.environ.get(key) for key in ('TEMP', 'TMP', 'TMPDIR')}
                previous_tempdir = tempfile.tempdir
                try:
                    for key in previous:
                        os.environ[key] = str(temporary)
                    tempfile.tempdir = str(temporary)
                    parse = self.parse
                    if parse is None:
                        from mineru.parser import parse_async
                        parse = parse_async
                    unplaced_visuals = 0
                    if extension == 'docx':
                        from docx_media import prepare_docx
                        from mineru.utils.async_utils import run_sync
                        prepared, unplaced_visuals = await run_sync(prepare_docx, data, MAX_IMAGES)
                        if prepared is not data:
                            data = prepared
                            source = path / 'normalized.docx'
                            source.write_bytes(data)
                    if extension in CONTAINER_IMAGES:
                        from mineru.utils.async_utils import run_sync
                        data = await run_sync(primary_image_png, data, extension)
                        source = path / 'decoded.png'
                        source.write_bytes(data)
                    result = await parse(source, tier='flash' if extension == 'docx' else 'basic', ocr_mode='auto', image_analysis=False)
                    writer = ZipWriter()
                    if extension == 'pdf' and self.parse is None:
                        from mineru.config import get_config
                        from mineru.utils.async_utils import run_sync
                        from pdf_ocr import MODEL_NAME, save_pdf
                        model = Path(get_config().model.base_dir) / 'anyko' / MODEL_NAME
                        await run_sync(save_pdf, source, result.middle_json, writer, model)
                    else:
                        result.save(writer)
                    if unplaced_visuals:
                        from docx_media import SKIPPED_VISUAL
                        markdown = writer.files['markdown.md'].decode('utf-8')
                        writer.replace_markdown(f'{markdown}\n\n> {SKIPPED_VISUAL} Количество: {unplaced_visuals}.')
                    if extension in RASTER_FORMATS and self.parse is None:
                        from mineru.utils.async_utils import run_sync
                        await run_sync(save_raster_text, writer, data, extension)
                    else:
                        visual_inputs(writer, data, extension)
                    return writer.archive()
                finally:
                    tempfile.tempdir = previous_tempdir
                    for key, value in previous.items():
                        if value is None:
                            os.environ.pop(key, None)
                        else:
                            os.environ[key] = value
        finally:
            self.erase_dir(identity)

    async def submit(self, identity, data, extension):
        self.job_dir(identity)
        async with self.guard:
            if (self.cancelled / identity).exists():
                raise HTTPException(410, 'ATTEMPT_ERASED')
            if identity in self.active:
                raise HTTPException(409, 'ATTEMPT_ACTIVE')
            task = asyncio.create_task(self.run(identity, data, extension))
            self.active[identity] = task
            task.add_done_callback(lambda finished: self.completed(identity, finished))
        try:
            return await asyncio.shield(task)
        finally:
            if task.done():
                self.active.pop(identity, None)

    def completed(self, identity, task):
        if self.active.get(identity) is task:
            self.active.pop(identity, None)
        if not task.cancelled():
            task.exception()

    async def erase(self, identity):
        self.job_dir(identity)
        async with self.guard:
            (self.cancelled / identity).touch()
            task = self.active.get(identity)
            if task and not task.done() and not task.cancelling():
                task.cancel()
        if task:
            # MinerU's supported async wrapper drains the real OCR thread on cancel.
            await asyncio.gather(task, return_exceptions=True)
        self.erase_dir(identity)
        self.active.pop(identity, None)


processor = Processor(os.environ.get('ANYKO_PROCESSOR_ROOT', 'work/mineru/processor'))


@asynccontextmanager
async def lifespan(_app):
    processor.start()
    try:
        yield
    finally:
        for identity in list(processor.active):
            await processor.erase(identity)
        processor.lock.close()


app = FastAPI(lifespan=lifespan)


def save_raster_text(writer, data, extension):
    import numpy as np
    from mineru.config import get_config
    from pdf_ocr import MODEL_NAME, read_image_lines, recover_image_markdown

    model = Path(get_config().model.base_dir) / 'anyko' / MODEL_NAME

    def recognize(image):
        bgr = np.ascontiguousarray(np.asarray(image)[:, :, ::-1])
        return read_image_lines(bgr, model)

    frames = visual_inputs(writer, data, extension, recognize=recognize)
    markdown = recover_image_markdown(writer.files['markdown.md'].decode('utf-8'), frames)
    if markdown is not None:
        writer.replace_markdown(markdown)


@app.get('/v1/health')
async def health():
    return {'status': 'ok', 'mode': 'stateless-sdk', 'pdfOcrVersion': 1, 'pdfPageLayoutVersion': 1, 'imageOcrVersion': 1, 'docxVisualExportVersion': 1,
            'imageFormats': sorted(RASTER_FORMATS), 'maxImages': MAX_IMAGES,
            'pdfFormulaVersion': 1, 'docxLegacyVisualVersion': 1}


@app.put('/v1/attempts/{identity}')
async def parse(identity: uuid.UUID, request: Request, format: str):
    if format not in RASTER_FORMATS and format not in {'pdf', 'docx'}:
        raise HTTPException(400, 'UNSUPPORTED_FORMAT')
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > 20 * 1024 * 1024:
            raise HTTPException(413, 'INPUT_TOO_LARGE')
    if len(data) < 5:
        raise HTTPException(400, 'INVALID_DOCUMENT')
    try:
        result = await processor.submit(str(identity), bytes(data), format)
        processor_version = version('mineru')
        if format in RASTER_FORMATS:
            processor_version += '+eslav-image.1'
        return Response(result, media_type='application/zip', headers={'x-mineru-version': processor_version})
    except asyncio.CancelledError:
        raise HTTPException(409, 'ATTEMPT_CANCELLED')
    except HTTPException:
        raise
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and str(error) in REPORTED_ERRORS else 'PARSE_FAILED'
        logger.error('document_parse_failed attempt_id=%s format=%s error_type=%s error_code=%s',
                     identity, format, type(error).__name__, code)
        raise HTTPException(422, code, headers={'x-anyko-processor-error': code})


@app.delete('/v1/attempts/{identity}')
async def erase(identity: uuid.UUID):
    await processor.erase(str(identity))
    return Response(status_code=204)
