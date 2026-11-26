import base64
import io
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from docvortex.schema import MiddleJson
from PIL import Image, ImageDraw
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

sys.path.insert(0, str(Path('infra/mineru').resolve()))
import pdf_ocr
from processor import ZipWriter


class PdfTableOrigins(unittest.TestCase):
    def check_origin(self, *, expected, raster=False, heading=False, native=True,
                     cells=('Item', '42'), font='Helvetica', continues=False, html=None):
        crop = Image.new('RGB', (180, 55), 'white')
        draw = ImageDraw.Draw(crop)
        draw.rectangle((0, 0, 179, 54), outline='black')
        draw.line((100, 0, 100, 54), fill='black')
        draw.text((10, 20), 'Item', fill='black')
        draw.text((110, 20), '42', fill='black')

        pdf_bytes = io.BytesIO()
        canvas = Canvas(pdf_bytes, pagesize=(220, 140))
        if heading:
            # Even matching text outside the table is insufficient.
            canvas.drawString(30, 120, 'Item 42')
        if raster:
            canvas.drawImage(ImageReader(crop), 20, 40, 180, 55)
        else:
            canvas.rect(20, 40, 180, 55)
            canvas.line(120, 40, 120, 95)
        if native:
            canvas.setFont(font, 14)
            for x, value in zip((30, 130), cells):
                canvas.drawString(x, 60, value)
        canvas.showPage()
        canvas.save()

        image = io.BytesIO()
        crop.save(image, format='JPEG')
        payload = 'data:image/jpeg;base64,' + base64.b64encode(image.getvalue()).decode('ascii')
        bbox = [20 / 220, 45 / 140, 200 / 220, 100 / 140]
        if html is None:
            html = f'<table><tr><td>{cells[0]}</td><td>{cells[1]}</td></tr></table>'
        middle = MiddleJson.model_validate({
            'metadata': {'file_suffix': 'pdf', 'producer': {'name': 'fixture', 'version': '1'}},
            'is_full_document': True,
            'pages': [{'page_idx': 0, 'blocks': [{
                'type': 'table', 'index': 0, 'bbox': bbox, 'continues_prev': continues,
                'content': [{
                    'type': 'table_body', 'index': 0, 'bbox': bbox,
                    'content': html, 'image_base64': payload,
                }],
            }]}],
        })
        writer = ZipWriter()
        with patch.object(pdf_ocr, 'read_lines', return_value=([], [])):
            pdf_ocr.save_pdf(pdf_bytes.getvalue(), middle, writer, Path('unused-model.onnx'))
        records = json.loads(writer.files['pdf-table-images.json'])
        self.assertEqual(len(records), 1)
        record, = records
        self.assertEqual((record['page'], record['origin']), (1, expected))
        self.assertTrue(record['imagePath'].startswith('images/'))
        self.assertEqual(writer.files[record['imagePath']], image.getvalue())
        return writer.files['markdown.md'].decode()

    def test_native_table(self):
        self.assertIn('Item', self.check_origin(expected='native'))

    def test_native_html_table_with_merged_cells(self):
        markdown = self.check_origin(
            expected='native', html='<table><tr><td colspan="2">Item</td></tr>'
            '<tr><td>42</td><td></td></tr></table>',
        )
        self.assertIn('<table', markdown)

    def test_mixed_page_with_raster_table(self):
        self.check_origin(raster=True, heading=True, native=False, expected='unknown')

    def test_full_scan(self):
        self.check_origin(raster=True, native=False, expected='unknown')

    def test_scan_with_searchable_text_layer(self):
        self.check_origin(raster=True, expected='unknown')

    def test_partial_table_text_and_continuation_are_unknown(self):
        self.check_origin(expected='unknown', html='<table><tr><td>Item</td></tr></table>')
        self.check_origin(expected='unknown', continues=True)

    def test_cyrillic_native_table(self):
        fonts = (
            Path(os.getenv('WINDIR', 'C:/Windows')) / 'Fonts/arial.ttf',
            Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
            Path('/usr/share/fonts/TTF/DejaVuSans.ttf'),
            Path('/System/Library/Fonts/Supplemental/Arial.ttf'),
        )
        font_path = next((candidate for candidate in fonts if candidate.is_file()), None)
        if font_path is None:
            self.skipTest('a Cyrillic TrueType font is required')
        pdfmetrics.registerFont(TTFont('TableFixtureCyrillic', str(font_path)))
        markdown = self.check_origin(
            expected='native', cells=('Образец', 'Щётка'), font='TableFixtureCyrillic',
        )
        self.assertIn('Щётка', markdown)
