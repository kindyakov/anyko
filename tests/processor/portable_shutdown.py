"""Exercise a reset and shutdown of the portable processor using synthetic input."""
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request
import uuid

from PIL import Image, ImageDraw, ImageFont


def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def ready(proc, url):
    end = time.monotonic() + 90
    while time.monotonic() < end:
        if proc.poll() is not None:
            raise RuntimeError('Processor exited before ready')
        try:
            with urllib.request.urlopen(url + '/v1/health', timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(.2)
    raise RuntimeError('Processor readiness timeout')


def main():
    package = Path(sys.argv[1]).resolve()
    metadata = json.loads((package/'complete.json').read_text(encoding='utf8'))
    python = (package/metadata['python']).resolve()
    python.relative_to(package)
    temp = Path(tempfile.mkdtemp(prefix='anyko-ocr-drain-'))
    process = None
    try:
        model_home = temp/'home'
        shutil.copytree(package/'home', model_home)
        processor_root = temp/'processor'
        appdata = temp/'appdata'
        appdata.mkdir()
        number = port()
        url = f'http://127.0.0.1:{number}'
        env = {'SystemRoot': os.environ['SystemRoot'], 'PATH': str(Path(os.environ['SystemRoot'])/'System32'),
               'TEMP': str(temp), 'TMP': str(temp), 'USERPROFILE': str(temp), 'APPDATA': str(appdata),
               'LOCALAPPDATA': str(appdata), 'MINERU_HOME': str(model_home), 'HF_HOME': str(temp/'hf'),
               'HF_HUB_OFFLINE': '1', 'HF_HUB_DISABLE_XET': '1', 'MINERU_TELEMETRY_DISABLED': '1',
               'ANYKO_PROCESSOR_ROOT': str(processor_root), 'ANYKO_OCR_PORT': str(number),
               'ANYKO_TEST_PACKAGE': str(package), 'ANYKO_TEST_TRACE': str(temp/'trace')}
        wrapper = temp/'instrumented_serve.py'
        wrapper.write_text('''import os, runpy, sys, time\nfrom pathlib import Path\nimport mineru.backend.analyze as analyze\noriginal = analyze.doc_analyze\ndef traced(*args, **kwargs):\n    trace = Path(os.environ["ANYKO_TEST_TRACE"])\n    trace.write_text(str(time.monotonic_ns()) + "\\n")\n    try:\n        return original(*args, **kwargs)\n    finally:\n        with trace.open("a") as output:\n            output.write(str(time.monotonic_ns()) + "\\n")\nanalyze.doc_analyze = traced\nsys.path.insert(0, os.environ["ANYKO_TEST_PACKAGE"])\nrunpy.run_path(str(Path(os.environ["ANYKO_TEST_PACKAGE"]) / "serve_processor.py"), run_name="__main__")\n''', encoding='utf8')
        args = [str(python), '-B', str(wrapper)]

        def start():
            return subprocess.Popen(args, cwd=package, env=env, stdin=subprocess.DEVNULL,
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)

        process = start()
        ready(process, url)
        image = Image.new('RGB', (1200, 400), 'white')
        draw = ImageDraw.Draw(image)
        font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 46)
        draw.text((50, 60), 'ANYKO INTEGRATION TEST', font=font, fill='black')
        fixture = temp/'fixture.pdf'
        image.save(fixture, format='PDF', resolution=150)
        payload = fixture.read_bytes()
        identity = str(uuid.uuid4())
        sock = socket.create_connection(('127.0.0.1', number), timeout=10)
        try:
            header = (f'PUT /v1/attempts/{identity}?format=pdf HTTP/1.1\r\n'
                      f'Host: 127.0.0.1:{number}\r\nContent-Length: {len(payload)}\r\n'
                      'Connection: close\r\n\r\n').encode('ascii')
            sock.sendall(header + payload)
            end = time.monotonic() + 60
            while time.monotonic() < end and not (temp/'trace').exists():
                if process.poll() is not None:
                    raise RuntimeError('Processor exited during request')
                time.sleep(.1)
            if not (temp/'trace').exists() or not (temp/'trace').read_text().strip():
                raise RuntimeError('Real OCR thread did not start')
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack('HH', 1, 0))
        finally:
            sock.close()
        signal_time = time.monotonic_ns()
        process.send_signal(signal.CTRL_BREAK_EVENT)
        code = process.wait(timeout=300)
        if code:
            raise RuntimeError(f'Processor shutdown failed: {code}')
        process = None
        timestamps = [int(line) for line in (temp/'trace').read_text().splitlines()]
        if len(timestamps) != 2 or not timestamps[0] < signal_time < timestamps[1]:
            raise RuntimeError('OCR was not running across shutdown or did not drain')
        if any((processor_root/'jobs').iterdir()):
            raise RuntimeError('OCR attempt files survived shutdown')
        process = start()
        ready(process, url)
        process.send_signal(signal.CTRL_BREAK_EVENT)
        if process.wait(timeout=30):
            raise RuntimeError('Processor restart shutdown failed')
        process = None
        print('Reset, active OCR drain and restart passed', flush=True)
    finally:
        if process and process.poll() is None:
            process.terminate()
            process.wait(timeout=30)
        shutil.rmtree('\\\\?\\' + str(temp))


if __name__ == '__main__':
    main()
