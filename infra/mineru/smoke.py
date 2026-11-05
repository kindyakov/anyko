"""Real MinerU Tasks smoke, synthetic text PDF or image-only PDF; no client data."""
import argparse
import io
import json
import time
import urllib.request
import zipfile
from pathlib import Path


def main():
    args = argparse.ArgumentParser()
    args.add_argument('--tier', choices=['flash', 'basic'], default='flash')
    args.add_argument('--base-url', default='http://127.0.0.1:8000')
    args.add_argument('--timeout', type=int, default=300)
    options = args.parse_args()
    if options.tier == 'basic':
        from PIL import Image, ImageDraw, ImageFont
        image = Image.new('RGB', (1200, 400), 'white')
        draw = ImageDraw.Draw(image)
        font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 46)
        draw.text((50, 60), 'ANYKO INTEGRATION TEST', font=font, fill='black')
        draw.text((50, 150), 'Invoice total 123.45', font=font, fill='black')
        stream = io.BytesIO()
        image.save(stream, format='PDF', resolution=150)
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
    (fixtures / f'smoke-{options.tier}.pdf').write_bytes(data)

    def request(url, method='GET', body=None, content_type=None):
        headers = {'content-type': content_type} if content_type else {}
        with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=30) as response:
            return response.read()

    manifest = {'files': [{'file_name': 'fixture.pdf', 'bytes': len(data)}], 'tier': options.tier, 'ocr_mode': 'ocr' if options.tier == 'basic' else 'txt', 'output_formats': ['default']}
    receipt = json.loads(request(base + '/v1/tasks', 'POST', json.dumps(manifest).encode(), 'application/json'))
    target = receipt['files'][0].get('upload')
    if target:
        assert target['url'].startswith(base + '/')
        request(target['url'], 'PUT', data)
    deadline = time.monotonic() + options.timeout
    while time.monotonic() < deadline:
        task = json.loads(request(base + '/v1/tasks/' + receipt['task_id']))
        item = task['files'][0]
        if item['status'] == 'completed':
            assert item['result_url'].startswith(base + '/')
            archive = zipfile.ZipFile(io.BytesIO(request(item['result_url'])))
            markdown = archive.read('markdown.md').decode('utf-8')
            assert 'ANYKO' in markdown.upper(), 'Expected synthetic marker missing'
            out = Path('work/mineru')
            out.mkdir(parents=True, exist_ok=True)
            (out / f'smoke-{options.tier}.md').write_text(markdown, encoding='utf-8')
            print(json.dumps({'tier': options.tier, 'parserVersion': item['parse']['parser_version'], 'markdownBytes': len(markdown.encode()), 'syntheticMarker': True}))
            return
        if item['status'] in ('failed', 'canceled'):
            raise RuntimeError('MinerU smoke failed: ' + item.get('error', {}).get('code', item['status']))
        time.sleep(1)
    raise TimeoutError('MinerU smoke timed out')


if __name__ == '__main__':
    main()
