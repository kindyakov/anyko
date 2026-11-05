"""Anyko stateless MinerU SDK boundary. No Tasks/FileStore/document-library cache."""
import asyncio
from contextlib import asynccontextmanager
import io
from importlib.metadata import version
import os
from pathlib import Path, PurePosixPath
import shutil
import tempfile
import uuid
import zipfile

from fastapi import FastAPI, HTTPException, Request, Response


class ZipWriter:
    def __init__(self):
        self.files = {}
        self.size = 0

    def write(self, path, data):
        name = PurePosixPath(path)
        if name.is_absolute() or '..' in name.parts or '\\' in path:
            raise ValueError('INVALID_EXPORT_PATH')
        if path != 'markdown.md' and not path.startswith('images/'):
            return
        self.size += len(data)
        if self.size > 13 * 1024 * 1024 or len(self.files) >= 64 or path in self.files:
            raise ValueError('EXPORT_TOO_LARGE')
        self.files[path] = data

    def write_string(self, path, data):
        self.write(path, data.encode('utf-8'))

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
                    result = await parse(source, tier='flash' if extension == 'docx' else 'basic', ocr_mode='auto', image_analysis=False)
                    writer = ZipWriter()
                    result.save(writer)
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


@app.get('/v1/health')
async def health():
    return {'status': 'ok', 'mode': 'stateless-sdk'}


@app.put('/v1/attempts/{identity}')
async def parse(identity: uuid.UUID, request: Request, format: str):
    if format not in {'pdf', 'docx', 'jpg', 'png', 'webp', 'tiff'}:
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
        return Response(result, media_type='application/zip', headers={'x-mineru-version': version('mineru')})
    except asyncio.CancelledError:
        raise HTTPException(409, 'ATTEMPT_CANCELLED')
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422, 'PARSE_FAILED')


@app.delete('/v1/attempts/{identity}')
async def erase(identity: uuid.UUID):
    await processor.erase(str(identity))
    return Response(status_code=204)
