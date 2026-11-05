"""Real stateless MinerU smoke with synthetic documents and photos; no client data."""
import argparse
import io
import json
import urllib.request
import zipfile
import uuid
from pathlib import Path


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--tier', choices=['flash', 'basic'], default='basic', help='Synthetic PDF fixture kind; server chooses parser tier by format')
    args.add_argument('--base-url', default='http://127.0.0.1:8000')
    args.add_argument('--timeout', type=int, default=300)
    args.add_argument('--format', choices=['pdf', 'docx', 'jpeg', 'png', 'webp', 'tiff'], default='pdf')
    args.add_argument('--fixtures-only', action='store_true')
    options = args.parse_args()
    if options.format == 'docx':
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('[Content_Types].xml', '''<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>''')
            archive.writestr('_rels/.rels', '''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>''')
            archive.writestr('word/document.xml', '''<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>ANYKO DOCX INTEGRATION TEST</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Invoice total</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>123.45</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>''')
        data = stream.getvalue()
    elif options.tier == 'basic' or options.format != 'pdf':
        from PIL import Image, ImageDraw, ImageFont
        image = Image.new('RGB', (1200, 400), 'white')
        draw = ImageDraw.Draw(image)
        try:
            font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 46)
        except OSError:
            font = ImageFont.load_default(size=46)
        draw.text((50, 60), 'ANYKO INTEGRATION TEST', font=font, fill='black')
        draw.text((50, 150), 'Invoice total 123.45', font=font, fill='black')
        stream = io.BytesIO()
        image.save(stream, format=options.format.upper(), resolution=150)
        data = stream.getvalue()
    else:
        from reportlab.pdfgen import canvas
        stream = io.BytesIO()
        page = canvas.Canvas(stream)
        page.drawString(72, 760, 'ANYKO INTEGRATION TEST')
        page.drawString(72, 730, 'Invoice total 123.45')
        page.save()
        data = stream.getvalue()
    base = options.base_url.rstrip('/')
    fixtures = Path('work/mineru')
    fixtures.mkdir(parents=True, exist_ok=True)
    fixture = fixtures / f'smoke-{options.tier}.{options.format}'
    fixture.write_bytes(data)
    if options.fixtures_only:
        print(str(fixture))
        return

    def request(url, method='GET', body=None, content_type=None):
        headers = {'content-type': content_type} if content_type else {}
        with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=options.timeout) as response:
            return response.read()

    identity = str(uuid.uuid4())
    endpoint = base + '/v1/attempts/' + identity
    try:
        archive = zipfile.ZipFile(io.BytesIO(request(endpoint + '?format=' + options.format, 'PUT', data, 'application/octet-stream')))
        markdown = archive.read('markdown.md').decode('utf-8')
        assert 'ANYKO' in markdown.upper(), 'Expected synthetic marker missing'
        (fixtures / f'smoke-{options.tier}-{options.format}.md').write_text(markdown, encoding='utf-8')
        print(json.dumps({'tier': 'flash' if options.format == 'docx' else 'basic', 'format': options.format, 'markdownBytes': len(markdown.encode()), 'syntheticMarker': True}))
    finally:
        request(endpoint, 'DELETE')


if __name__ == '__main__':
    main()
