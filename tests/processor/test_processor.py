import asyncio
import base64
from contextlib import closing
import io
import zipfile
import importlib.util
import os
import subprocess
import sys
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
import uuid

from fastapi import HTTPException
import httpx
from importlib.metadata import distribution
sdk_spec = importlib.util.spec_from_file_location('sdk_async', distribution('mineru').locate_file('mineru/utils/async_utils.py'))
sdk_async = importlib.util.module_from_spec(sdk_spec)
sdk_spec.loader.exec_module(sdk_async)
run_sync = sdk_async.run_sync

sys.path.insert(0, str(Path('infra/mineru').resolve()))
import docx_media
import pdf_ocr
import processor as module


class PdfRecoveryReview(unittest.TestCase):
    def test_recovery_does_not_change_the_decimal_place_of_an_amount(self):
        amount = 'Сумма 1 234,50 руб.'
        wrong = 'Сумма 123450 руб. Дополнительный текст.'
        bbox = [0.1, 0.1, 0.6, 0.2]

        class Page:
            def get_size(self):
                return 100, 100

            def get_text_bounded(self, *bounds):
                return self.native

            def close(self):
                pass

            def get_textpage(self):
                return self

        for native in ('', amount):
            with self.subTest(has_text_layer=bool(native)):
                page = Page()
                page.native = native
                rows, markdown = pdf_ocr.recover_page_with_layout(
                    page, [{'text': wrong, 'confidence': 0.99, 'bbox': bbox}],
                    [(bbox, bbox[1], amount, True)],
                )
                self.assertEqual(markdown, amount)
                self.assertEqual(rows, [])

    def test_recovery_restores_cyrillic_around_an_unchanged_number(self):
        class Page:
            def get_size(self):
                return 100, 100

            def get_text_bounded(self, *bounds):
                return ''

            def close(self):
                pass

            def get_textpage(self):
                return self

        bbox = [0.1, 0.1, 0.6, 0.2]
        restored = 'Форма 1150001. Год 2023'
        line = {'text': restored, 'confidence': 0.99, 'bbox': bbox}
        rows, markdown = pdf_ocr.recover_page_with_layout(
            Page(), [line], [(bbox, bbox[1], '1150001.  2023', True)],
        )
        self.assertEqual(markdown, r'Форма 1150001\. Год 2023')
        self.assertEqual(rows, [[line]])

    def test_recovered_prose_keeps_a_single_structured_fraction_in_position(self):
        class TextPage:
            def get_text_bounded(self, *bounds):
                return ''

            def close(self):
                pass

        class Page:
            def get_size(self):
                return 100, 100

            def get_textpage(self):
                return TextPage()

        lines = [
            {'text': 'До формулы', 'confidence': 0.99, 'bbox': [0.1, 0.1, 0.4, 0.2]},
            {'text': '0,4484', 'confidence': 0.99, 'bbox': [0.3, 0.31, 0.5, 0.35]},
            {'text': '8', 'confidence': 0.99, 'bbox': [0.35, 0.4, 0.4, 0.45]},
            {'text': 'После формулы', 'confidence': 0.99, 'bbox': [0.1, 0.55, 0.5, 0.65]},
        ]
        fraction = '$$\n\\frac{0{,}4484}{8}\n$$'
        rows, markdown = pdf_ocr.recover_page_with_layout(
            Page(), lines, [([0.2, 0.3, 0.6, 0.5], 0.3, fraction, False)],
        )
        self.assertEqual(markdown, 'До формулы\n\n' + fraction + '\n\nПосле формулы')
        self.assertEqual([line['text'] for row in rows for line in row], ['До формулы', 'После формулы'])

    def test_recovery_keeps_tables_on_separate_pages_and_structured_blocks(self):
        import pypdfium2
        from docvortex.schema import MiddleJson
        from PIL import Image

        pages = []
        for index, value in enumerate(['Первое задание', 'Второе задание']):
            pages.append({
                'page_idx': index,
                'blocks': [{
                    'type': 'table', 'index': 0, 'bbox': [0.05, 0.05, 0.9, 0.4],
                    'continues_prev': index > 0,
                    'content': [{
                        'type': 'table_body', 'index': 0,
                        'content': f'<table><tr><td>Задание</td><td>{value}</td></tr></table>',
                    }],
                }],
            })
        picture = io.BytesIO()
        Image.new('RGB', (32, 32), 'blue').save(picture, format='PNG')
        image_data = 'data:image/png;base64,' + base64.b64encode(picture.getvalue()).decode()
        pages[0]['blocks'].extend([
            {'type': 'text', 'index': 1, 'bbox': [0.05, 0.58, 0.7, 0.62], 'content': [
                {'type': 'text', 'content': 'Формула '},
                {'type': 'equation_inline', 'content': 'a^2'},
            ]},
            {'type': 'image', 'index': 2, 'bbox': [0.05, 0.68, 0.7, 0.9], 'content': [
                {'type': 'image_body', 'index': 2, 'content': '', 'image_base64': image_data},
            ]},
            {'type': 'text', 'index': 3, 'bbox': [0.05, 0.92, 0.7, 0.99], 'content': [
                {'type': 'text', 'content': 'Данные из PDF. Номер 123456.'},
            ]},
        ])
        middle = MiddleJson.model_validate({
            'metadata': {'file_suffix': 'pdf', 'producer': {'name': 'fixture', 'version': '1'}},
            'is_full_document': True,
            'pages': pages,
        })
        source = io.BytesIO()
        with closing(pypdfium2.PdfDocument.new()) as document:
            for _ in pages:
                document.new_page(200, 200).close()
            document.save(source)

        lines = [
            {'text': 'Отсутствующий русский абзац', 'confidence': 0.99,
             'bbox': [0.05, 0.5, 0.65, 0.55]},
            {'text': 'Задание', 'confidence': 0.99, 'bbox': [0.1, 0.1, 0.3, 0.15]},
            {'text': 'Формула a2', 'confidence': 0.99, 'bbox': [0.05, 0.59, 0.4, 0.61]},
            {'text': 'Данные из PDF', 'confidence': 0.99, 'bbox': [0.05, 0.92, 0.4, 0.94]},
            {'text': 'Номер 123459', 'confidence': 0.10, 'bbox': [0.05, 0.95, 0.4, 0.98]},
        ]
        writer = module.ZipWriter()
        with patch.object(pdf_ocr, 'read_lines', side_effect=[lines, []]):
            pdf_ocr.save_pdf(source.getvalue(), middle, writer, Path('unused-model.onnx'))
        markdown = writer.files['markdown.md'].decode('utf-8')
        first, second = markdown.split('## Страница 2')
        self.assertIn('## Страница 1', first)
        self.assertIn('| Задание | Первое задание |', first)
        self.assertIn('Отсутствующий русский абзац', first)
        self.assertEqual(first.count('Задание'), 1)
        self.assertIn('$a^2$', first)
        self.assertNotIn('Формула a2', first)
        self.assertIn('Данные из PDF. Номер 123456.', first)
        self.assertEqual(first.count('Данные из PDF'), 1)
        self.assertNotIn('123459', first)
        images = [name for name in writer.files if name.startswith('images/')]
        self.assertEqual(len(images), 1)
        self.assertIn(f']({images[0]})', first)
        self.assertIn('| Задание | Второе задание |', second)

    def test_two_matching_readings_preserve_number_and_a_conflict_is_excluded(self):
        class TextPage:
            def get_text_bounded(self, left, bottom, right, top):
                return '1234 5678' if left < 50 else '5432 1876'

            def close(self):
                pass

        class Page:
            def get_size(self):
                return 100, 100

            def get_textpage(self):
                return TextPage()

        lines = [
            {'text': 'O1234 5678', 'confidence': 0.79, 'bbox': [0.1, 0.1, 0.4, 0.2]},
            {'text': '5432 1976', 'confidence': 0.99, 'bbox': [0.6, 0.1, 0.9, 0.2]},
        ]
        rows = pdf_ocr.recover_page(Page(), lines)
        self.assertEqual([[line['text'] for line in row] for row in rows], [['1234 5678']])


class RasterRecoveryReview(unittest.TestCase):
    def test_missing_cyrillic_replaces_symbols_and_keeps_row_order(self):
        frames = [[
            {'text': 'Жареная', 'confidence': 0.98, 'bbox': [0.5, 0.1, 0.9, 0.2]},
            {'text': 'Деревянный', 'confidence': 0.98, 'bbox': [0.1, 0.1, 0.4, 0.2]},
            {'text': 'Крossвorд', 'confidence': 0.65, 'bbox': [0.1, 0.4, 0.4, 0.5]},
            {'text': 'Стеклянный', 'confidence': 0.98, 'bbox': [0.1, 0.3, 0.4, 0.4]},
        ]]
        self.assertEqual(
            pdf_ocr.recover_image_markdown('1\n\n2\n\n3', frames),
            'Деревянный　Жареная\n\nСтеклянный',
        )

    def test_non_cyrillic_fallback_keeps_the_basic_result(self):
        frames = [[{'text': 'Invoice 2026', 'confidence': 0.99, 'bbox': [0.1, 0.1, 0.5, 0.2]}]]
        self.assertIsNone(pdf_ocr.recover_image_markdown('Invoice 2026', frames))


class Result:
    def save(self, writer):
        writer.write('markdown.md', b'# SYNTHETIC')

class ProcessorReview(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        parent = Path('work/processor-tests').resolve()
        parent.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=parent, prefix='fixture-')
        self.root = Path(self.temporary.name)
        self.release = threading.Event()
        self.started = threading.Event()
        self.finished = threading.Event()
        def sync_parse(path):
            self.assertTrue(path.exists())
            self.started.set()
            if not self.release.wait(3):
                raise TimeoutError('controlled test release missing')
            self.assertTrue(path.exists())
            self.finished.set()
            return Result()
        async def fake_parse(path, **kwargs):
            return await run_sync(sync_parse, path)
        self.processor = module.Processor(self.root, parse=fake_parse)
        self.processor.start()
        self.identity = str(uuid.uuid4())

    async def asyncTearDown(self):
        self.release.set()
        for identity in list(self.processor.active):
            await self.processor.erase(identity)
        self.processor.lock.close()
        self.temporary.cleanup()

    async def test_visual_only_normalizes_tiff_frames_without_running_ocr(self):
        from PIL import Image

        source = io.BytesIO()
        first = Image.new('RGB', (60, 40), 'white')
        second = Image.new('RGB', (60, 40), 'red')
        first.save(source, format='TIFF', save_all=True, append_images=[second])
        result = await self.processor.submit(
            self.identity, source.getvalue(), 'tiff', visual_only=True,
        )
        with zipfile.ZipFile(io.BytesIO(result)) as archive:
            self.assertEqual(archive.read('markdown.md'), b'')
            self.assertEqual(archive.namelist(), [
                'markdown.md', 'images/anyko-source-000.jpg', 'images/anyko-source-001.jpg',
            ])
        self.assertFalse(self.started.is_set())
        self.assertFalse(self.processor.job_dir(self.identity).exists())

    async def begin(self):
        task = asyncio.create_task(self.processor.submit(self.identity, b'%PDF-fixture', 'pdf'))
        self.assertTrue(await asyncio.to_thread(self.started.wait, 1))
        return task

    async def test_repeated_erase_waits_for_real_thread_then_erases_and_rejects_late_put(self):
        submit = await self.begin()
        first = asyncio.create_task(self.processor.erase(self.identity))
        await asyncio.sleep(.03)
        second = asyncio.create_task(self.processor.erase(self.identity))
        await asyncio.sleep(.03)
        self.assertFalse(first.done())
        self.assertFalse(second.done())
        self.assertTrue((self.root/'jobs'/self.identity/'source.pdf').exists())
        self.release.set()
        await asyncio.gather(first, second)
        with self.assertRaises(asyncio.CancelledError):
            await submit
        self.assertTrue(self.finished.is_set())
        self.assertFalse((self.root/'jobs'/self.identity).exists())
        self.assertNotIn(self.identity, self.processor.active)
        with self.assertRaises(HTTPException) as caught:
            await self.processor.submit(self.identity, b'%PDF-fixture', 'pdf')
        self.assertEqual(caught.exception.status_code, 410)

    async def test_cancelled_submit_does_not_retain_completed_result_in_active(self):
        submit = await self.begin()
        submit.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await submit
        self.release.set()
        self.assertTrue(await asyncio.to_thread(self.finished.wait, 1))
        await asyncio.sleep(.03)
        self.assertFalse((self.root/'jobs'/self.identity).exists())
        self.assertNotIn(self.identity, self.processor.active)

    async def test_restart_sweeps_only_job_content_and_keeps_cancel_id_marker(self):
        (self.root/'jobs'/self.identity).mkdir()
        (self.root/'jobs'/self.identity/'source.pdf').write_bytes(b'%PDF-fixture')
        (self.root/'cancelled'/self.identity).touch()
        sentinel = self.root/'models-marker'
        sentinel.write_text('not document', encoding='utf-8')
        self.processor.lock.close()
        self.processor.start()
        self.assertFalse((self.root/'jobs'/self.identity).exists())
        self.assertTrue((self.root/'cancelled'/self.identity).exists())
        self.assertTrue(sentinel.exists())
        with self.assertRaises(HTTPException) as caught:
            await self.processor.submit(self.identity, b'%PDF-fixture', 'pdf')
        self.assertEqual(caught.exception.status_code, 410)

    async def test_start_rejects_jobs_root_symlink_before_sweeping_foreign_tree(self):
        self.processor.lock.close()
        (self.root/'jobs').rmdir()
        with tempfile.TemporaryDirectory(dir=self.root.parent, prefix='foreign-') as foreign:
            target = Path(foreign)
            owned_elsewhere = target/self.identity
            owned_elsewhere.mkdir()
            sentinel = owned_elsewhere/'source.pdf'
            sentinel.write_bytes(b'%PDF-foreign-fixture')
            try:
                os.symlink(target, self.root/'jobs', target_is_directory=True)
            except OSError as error:
                if os.name != 'nt':
                    self.skipTest(str(error))
                subprocess.run(['rtk','proxy','bun','tests/processor/create-junction.mjs',str(target),str(self.root/'jobs')],check=True,capture_output=True)
            with self.assertRaises((ValueError, RuntimeError)):
                self.processor.start()
            self.assertTrue(sentinel.exists())

    async def test_http_delete_waits_for_parser_cleanup_and_late_upload_is_gone(self):
        previous = module.processor
        module.processor = self.processor
        try:
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=module.app), base_url='http://processor.test') as client:
                request = asyncio.create_task(client.put('/v1/attempts/'+self.identity+'?format=pdf', content=b'%PDF-fixture'))
                self.assertTrue(await asyncio.to_thread(self.started.wait, 1))
                erase = asyncio.create_task(client.delete('/v1/attempts/'+self.identity))
                await asyncio.sleep(.03)
                self.assertFalse(erase.done())
                self.release.set()
                self.assertEqual((await request).status_code,409)
                self.assertEqual((await erase).status_code,204)
                self.assertFalse((self.root/'jobs'/self.identity).exists())
                late = await client.put('/v1/attempts/'+self.identity+'?format=pdf', content=b'%PDF-fixture')
                self.assertEqual(late.status_code,410)
        finally:
            module.processor = previous

    async def test_docx_warning_without_inline_position_survives_export(self):
        source = io.BytesIO()
        with zipfile.ZipFile(source, 'w') as archive:
            archive.writestr('word/media/source.wmf', b'Unreadable WMF')
            archive.writestr('word/_rels/document.xml.rels', '''
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/source.wmf"/>
</Relationships>''')

        async def parse(path, **options):
            with zipfile.ZipFile(path) as prepared:
                self.assertNotIn('word/media/source.wmf', prepared.namelist())
            return Result()

        self.processor.parse = parse
        exported = await self.processor.submit(self.identity, source.getvalue(), 'docx')
        with zipfile.ZipFile(io.BytesIO(exported)) as archive:
            markdown = archive.read('markdown.md').decode('utf-8')
        self.assertEqual(markdown.count(docx_media.SKIPPED_VISUAL), 1)
        self.assertIn('Количество: 1.', markdown)

    async def test_docx_checks_original_media_count_before_skipping_metafiles(self):
        source = io.BytesIO()
        with zipfile.ZipFile(source, 'w') as archive:
            for index in range(module.MAX_IMAGES + 1):
                archive.writestr(f'word/media/image{index}.wmf', b'Unreadable WMF')

        async def parse(path, **options):
            return Result()

        self.processor.parse = parse
        with self.assertRaisesRegex(ValueError, 'TOO_MANY_EXPORTED_IMAGES'):
            await self.processor.submit(self.identity, source.getvalue(), 'docx')

class VisualExportReview(unittest.TestCase):
    def test_unreadable_wmf_is_marked_at_its_original_position(self):
        from lxml import etree

        source = self.metafile_document()
        prepared, unplaced = docx_media.prepare_docx(source, module.MAX_IMAGES)
        with zipfile.ZipFile(io.BytesIO(prepared)) as document:
            self.assertNotIn('word/media/source.wmf', document.namelist())
            text = ''.join(etree.fromstring(document.read('word/document.xml')).itertext())
            self.assertLess(text.index('Before'), text.index(docx_media.SKIPPED_VISUAL))
            self.assertLess(text.index(docx_media.SKIPPED_VISUAL), text.index('After'))
        self.assertEqual(unplaced, 0)
        with zipfile.ZipFile(io.BytesIO(source)) as original:
            self.assertIn('word/media/source.wmf', original.namelist())

    def test_converted_wmf_keeps_relationship_and_becomes_a_png(self):
        from PIL import Image

        picture = io.BytesIO()
        Image.new('RGB', (100, 50), 'blue').save(picture, format='PNG')
        with patch.object(docx_media, 'image_png', return_value=picture.getvalue()):
            prepared, unplaced = docx_media.prepare_docx(self.metafile_document(), module.MAX_IMAGES)
        with zipfile.ZipFile(io.BytesIO(prepared)) as document:
            self.assertEqual(document.read('word/media/anyko-legacy-0.png'), picture.getvalue())
            self.assertIn(b'Target="media/anyko-legacy-0.png"', document.read('word/_rels/document.xml.rels'))
            self.assertIn(b'r:id="rId1"', document.read('word/document.xml'))
            self.assertIn(b'ContentType="image/png"', document.read('[Content_Types].xml'))
        self.assertEqual(unplaced, 0)

    def metafile_document(self):
        source = io.BytesIO()
        with zipfile.ZipFile(source, 'w') as archive:
            archive.writestr('word/media/source.wmf', b'Unreadable WMF')
            archive.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
            archive.writestr('word/_rels/document.xml.rels', '''
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/source.wmf"/>
</Relationships>''')
            archive.writestr('word/document.xml', '''
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:v="urn:schemas-microsoft-com:vml" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body><w:p><w:r><w:t>Before</w:t></w:r><w:r><w:pict><v:imagedata r:id="rId1"/></w:pict></w:r>
  <w:r><w:t>After</w:t></w:r></w:p></w:body>
</w:document>''')
        return source.getvalue()

    def test_all_tiff_frames_are_exported_as_independent_images(self):
        from PIL import Image
        first = Image.new('RGB', (60, 40), 'red')
        second = Image.new('RGB', (60, 40), 'blue')
        source = io.BytesIO()
        first.save(source, format='TIFF', save_all=True, append_images=[second])
        writer = module.ZipWriter()
        module.visual_inputs(writer, source.getvalue(), 'tiff')
        self.assertEqual(sorted(writer.files), ['images/anyko-source-000.jpg', 'images/anyko-source-001.jpg'])
        with Image.open(io.BytesIO(writer.files['images/anyko-source-001.jpg'])) as image:
            self.assertEqual(image.format, 'JPEG')
            self.assertGreater(image.getpixel((5, 5))[2], 240)

    def test_docx_embedded_picture_has_an_explicit_visual_even_without_markdown_reference(self):
        from PIL import Image
        picture = io.BytesIO()
        Image.new('RGB', (80, 50), 'white').save(picture, format='PNG')
        source = io.BytesIO()
        with zipfile.ZipFile(source, 'w') as archive:
            archive.writestr('word/media/picture.png', picture.getvalue())
        writer = module.ZipWriter()
        module.visual_inputs(writer, source.getvalue(), 'docx')
        self.assertIn('images/docx-media-000-000.jpg', writer.files)
        self.assertNotIn('markdown.md', writer.files)

    def test_docx_keeps_inline_sdk_picture_and_exports_only_missing_media(self):
        from PIL import Image

        first = Image.new('RGB', (80, 50), 'red')
        second = Image.new('RGB', (80, 50), 'blue')
        original, recoded, missing = io.BytesIO(), io.BytesIO(), io.BytesIO()
        first.save(original, format='PNG', compress_level=0)
        first.save(recoded, format='PNG', compress_level=9)
        second.save(missing, format='PNG')
        self.assertNotEqual(original.getvalue(), recoded.getvalue())
        source = io.BytesIO()
        with zipfile.ZipFile(source, 'w') as archive:
            archive.writestr('word/media/image1.png', original.getvalue())
            archive.writestr('word/media/image2.png', missing.getvalue())
        writer = module.ZipWriter()
        markdown = 'Первое замечание\n\n![](images/sdk-preview.png)\n\nВторое замечание'
        writer.write_string('markdown.md', markdown)
        writer.write('images/sdk-preview.png', recoded.getvalue())

        module.visual_inputs(writer, source.getvalue(), 'docx')

        self.assertEqual(writer.files['markdown.md'].decode(), markdown)
        self.assertEqual(set(writer.files), {'markdown.md', 'images/sdk-preview.png', 'images/docx-media-001-000.jpg'})

    def test_unsupported_docx_graphic_is_an_explicit_failure(self):
        source = io.BytesIO()
        with zipfile.ZipFile(source, 'w') as archive:
            archive.writestr('word/media/picture.wmf', b'unsupported')
        with self.assertRaisesRegex(ValueError, 'UNSUPPORTED_DOCUMENT_VISUAL'):
            module.visual_inputs(module.ZipWriter(), source.getvalue(), 'docx')

if __name__ == '__main__':
    unittest.main()
