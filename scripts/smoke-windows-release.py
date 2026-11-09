"""Run a relocated portable bundle, then verify its data after restart."""
import http.cookiejar
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ctypes
from ctypes import wintypes
import io
import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import uuid
import zipfile

source = Path(sys.argv[1]).resolve()
smoke = Path(sys.argv[2]).resolve()
if json.loads((source/'complete.json').read_text(encoding='utf8')).get('format') != 1 or (source/'data').exists():
    raise RuntimeError('Release must be a completed, unused build')
temporary = Path(tempfile.mkdtemp(prefix='anyko-release-smoke-'))
release = temporary/'Anyko-Тест'
probe = temporary/'probe'
process = None
provider = None
passed = False
env = {**os.environ, 'ANYKO_NO_BROWSER': '1', 'PYTHONUTF8': '1', 'HTTP_PROXY': 'http://127.0.0.1:1',
       'HTTPS_PROXY': 'http://127.0.0.1:1', 'http_proxy': 'http://127.0.0.1:1',
       'https_proxy': 'http://127.0.0.1:1', 'NO_PROXY': '', 'no_proxy': ''}


def extended(path):
    return '\\\\?\\' + str(path)


def start():
    child = subprocess.Popen([str(release/'Anyko.exe')], cwd=probe, env=env, stdin=subprocess.PIPE,
                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                             encoding='utf8', errors='replace')
    messages = queue.Queue()
    reader = threading.Thread(target=lambda: [messages.put(line) for line in child.stdout], daemon=True)
    reader.start()
    history = []
    end = time.monotonic() + 240
    while time.monotonic() < end:
        if child.poll() is not None:
            reader.join(timeout=3)
            raise RuntimeError(f'Launcher exited ({child.returncode}): ' + ''.join(history + list(messages.queue))[-1200:])
        try:
            line = messages.get(timeout=.2)
            history.append(line)
            if line.startswith('Anyko: '):
                return child, line.strip().removeprefix('Anyko: ')
        except queue.Empty:
            pass
    child.terminate()
    child.wait()
    raise RuntimeError('Launcher startup timeout')


def stop(child):
    child.stdin.write('\n')
    child.stdin.flush()
    child.wait(timeout=360)
    if child.returncode:
        raise RuntimeError(f'Launcher shutdown failed: {child.returncode}')


def descendant_handles(pid):
    class ProcessEntry(ctypes.Structure):
        _fields_ = [('size', wintypes.DWORD), ('usage', wintypes.DWORD), ('pid', wintypes.DWORD),
                    ('heap', ctypes.c_size_t), ('module', wintypes.DWORD), ('threads', wintypes.DWORD),
                    ('parent', wintypes.DWORD), ('priority', wintypes.LONG), ('flags', wintypes.DWORD),
                    ('name', wintypes.WCHAR * 260)]
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateToolhelp32Snapshot.argtypes = [wintypes.DWORD, wintypes.DWORD]
    kernel.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
    kernel.Process32FirstW.argtypes = [wintypes.HANDLE, ctypes.POINTER(ProcessEntry)]
    kernel.Process32NextW.argtypes = [wintypes.HANDLE, ctypes.POINTER(ProcessEntry)]
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel.WaitForSingleObject.restype = wintypes.DWORD
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    snapshot = kernel.CreateToolhelp32Snapshot(2, 0)
    if snapshot == wintypes.HANDLE(-1).value:
        raise OSError(ctypes.get_last_error(), 'Cannot inspect process tree')
    edges = []
    try:
        entry = ProcessEntry()
        entry.size = ctypes.sizeof(entry)
        present = kernel.Process32FirstW(snapshot, ctypes.byref(entry))
        while present:
            edges.append((entry.parent, entry.pid))
            present = kernel.Process32NextW(snapshot, ctypes.byref(entry))
    finally:
        kernel.CloseHandle(snapshot)
    descendants = {pid}
    while True:
        expanded = descendants | {child for parent, child in edges if parent in descendants}
        if expanded == descendants:
            break
        descendants = expanded
    descendants.remove(pid)
    if len(descendants) < 5:
        raise RuntimeError('Expected launcher process tree not found')
    handles = []
    try:
        for child in descendants:
            handle = kernel.OpenProcess(0x100000, False, child)
            if not handle:
                raise OSError(ctypes.get_last_error(), 'Cannot inspect launcher child')
            handles.append(handle)
        return kernel, handles
    except Exception:
        for handle in handles:
            kernel.CloseHandle(handle)
        raise


try:
    shutil.copytree(extended(source), extended(release))
    probe.mkdir()
    (probe/'work').mkdir()
    metadata = json.loads((release/'mineru/complete.json').read_text(encoding='utf8'))
    python = (release/'mineru'/metadata['python']).resolve()
    python.relative_to((release/'mineru').resolve())
    fixture = probe/'synthetic.pdf'
    generate = "from PIL import Image,ImageDraw,ImageFont; import sys; im=Image.new('RGB',(1200,400),'white'); d=ImageDraw.Draw(im); f=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',46); d.text((50,60),'ANYKO INTEGRATION TEST',font=f,fill='black'); im.save(sys.argv[1],format='PDF',resolution=150)"
    subprocess.run([str(python), '-I', '-B', '-c', generate, str(fixture)], check=True, cwd=probe, timeout=30)
    process, origin = start()
    config = json.loads((release/'data/settings.json').read_text(encoding='utf8'))
    test_env = {**env, 'NO_PROXY': '127.0.0.1', 'no_proxy': '127.0.0.1',
                'LOCAL_USER_EMAIL': config['login'], 'LOCAL_USER_PASSWORD': config['password'], 'APP_ORIGIN': origin}
    result = subprocess.run([str(smoke), str(fixture)], cwd=probe, env=test_env, capture_output=True, timeout=420)
    if result.returncode:
        raise RuntimeError('Document smoke failed: ' + result.stderr.decode(errors='replace')[-800:].replace(config['password'], '[redacted]'))
    document = json.loads((probe/'work/document-smoke-synthetic.pdf.json').read_text(encoding='utf8'))['documentId']
    stop(process)
    process = None
    process, origin = start()
    cookies = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(cookies))
    body = json.dumps({'email': config['login'], 'password': config['password']}).encode()
    request = urllib.request.Request(origin+'/api/auth/sign-in/email', data=body,
                                     headers={'content-type': 'application/json', 'origin': origin}, method='POST')
    opener.open(request, timeout=30).close()
    with opener.open(origin+'/api/documents/'+document+'/result', timeout=30) as response:
        result = json.load(response)
    if 'ANYKO' not in result['markdown'].upper():
        raise RuntimeError('OCR result was not preserved after restart')
    def request(path, value=None):
        headers = {'origin': origin}
        data = None
        if value is not None:
            data = json.dumps(value).encode()
            headers['content-type'] = 'application/json'
        req = urllib.request.Request(origin+'/api'+path, data=data, headers=headers,
                                     method='POST' if value is not None else 'GET')
        with opener.open(req, timeout=30) as response:
            return response.read()
    model_state = {'document': '', 'calls': 0}
    class ModelHandler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass
        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers['content-length'])))
            model_state['calls'] += 1
            messages = body.get('messages', [])
            serialized = json.dumps(messages)
            coordinator = 'documents.analyzed' in serialized
            visual = 'image_url' in serialized
            tools = body.get('tools', [])
            tool = (tools[0]['function']['name'] if tools and not coordinator and not visual
                    and not any(item.get('role') == 'tool' for item in messages) else None)
            text = json.dumps({'summary': 'Synthetic context', 'candidates': []} if coordinator else
                              {'description': 'Synthetic image'} if visual else
                              {'candidates': [{'field': 'firstName', 'value': 'ANYKO',
                                               'evidence': [{'documentId': model_state['document'],
                                                             'imagePath': None, 'quote': 'ANYKO'}]}]})
            calls = [{'id': 'call_fixture', 'type': 'function',
                      'function': {'name': tool, 'arguments': '{"offset":0}'}}] if tool else None
            finish = 'tool_calls' if tool else 'stop'
            if body.get('stream'):
                delta = {'role': 'assistant'}
                if calls:
                    delta['tool_calls'] = [{'index': 0, **calls[0]}]
                else:
                    delta['content'] = text
                chunks = [{'id': 'fixture', 'model': body['model'], 'choices': [{'index': 0, 'delta': delta, 'finish_reason': None}]},
                          {'id': 'fixture', 'model': body['model'], 'choices': [{'index': 0, 'delta': {}, 'finish_reason': finish}],
                           'usage': {'prompt_tokens': 10, 'completion_tokens': 5, 'total_tokens': 15}}]
                payload = (''.join('data: '+json.dumps(chunk)+'\n\n' for chunk in chunks)+'data: [DONE]\n\n').encode()
                content_type = 'text/event-stream'
            else:
                message = {'role': 'assistant', 'content': None if tool else text}
                if calls:
                    message['tool_calls'] = calls
                payload = json.dumps({'id': 'fixture', 'model': body['model'], 'choices': [{'index': 0, 'message': message, 'finish_reason': finish}],
                                      'usage': {'prompt_tokens': 10, 'completion_tokens': 5, 'total_tokens': 15}}).encode()
                content_type = 'application/json'
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
    provider = ThreadingHTTPServer(('127.0.0.1', 0), ModelHandler)
    threading.Thread(target=provider.serve_forever, daemon=True).start()
    request('/settings/llm', {'baseURL': f'http://127.0.0.1:{provider.server_port}/v1',
                              'visionModel': 'fixture', 'extractionModel': 'fixture', 'apiKey': 'synthetic-key'})
    created = json.loads(request('/works', {'packageVersion': 'bfl-bankruptcy-v3', 'title': 'Synthetic test'}))
    work = created['work']['id']
    boundary = 'anyko-' + uuid.uuid4().hex
    payload = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic.pdf"\r\n'
               'Content-Type: application/pdf\r\n\r\n').encode() + fixture.read_bytes() + f'\r\n--{boundary}--\r\n'.encode()
    upload = urllib.request.Request(origin+'/api/works/'+work+'/documents', data=payload, method='POST',
                                    headers={'origin': origin, 'content-type': 'multipart/form-data; boundary='+boundary,
                                             'idempotency-key': str(uuid.uuid4())})
    with opener.open(upload, timeout=30) as response:
        model_state['document'] = json.load(response)['document']['id']
    request('/works/'+work+'/analyze', {})
    end = time.monotonic() + 300
    while time.monotonic() < end:
        analyzed = json.loads(request('/works/'+work))
        runs = [run for run in analyzed['runs'] if run['kind'] == 'analysis']
        if runs and runs[0]['status'] not in ('queued', 'running'):
            break
        time.sleep(.5)
    else:
        raise RuntimeError('Work analysis timed out')
    if runs[0]['status'] != 'succeeded' or not model_state['calls']:
        raise RuntimeError('Work analysis with synthetic provider failed: ' + str(runs[0].get('errorCode')))
    if analyzed['facts']['values']['firstName'] != 'ANYKO':
        raise RuntimeError('Synthetic AI extraction was not preserved')
    values = analyzed['facts']['values']
    values['lastName'] = 'Testov'
    values['firstName'] = 'Anyko'
    edited = json.loads(request('/works/'+work+'/fields', {'revision': analyzed['work']['revision'], 'values': values}))
    request('/works/'+work+'/generate', {'revision': edited['work']['revision']})
    end = time.monotonic() + 120
    while time.monotonic() < end:
        view = json.loads(request('/works/'+work))
        generations = view['generations']
        if generations and generations[0]['status'] in ('succeeded', 'failed', 'partial'):
            break
        time.sleep(.5)
    else:
        raise RuntimeError('DOCX generation timed out')
    generation = generations[0]
    if generation['status'] != 'succeeded' or len(generation['files']) != 3:
        raise RuntimeError('DOCX package generation failed')
    for file in generation['files']:
        content = request('/works/'+work+'/generations/'+generation['id']+'/files/'+file['id'])
        xml = zipfile.ZipFile(io.BytesIO(content)).read('word/document.xml').decode('utf8')
        if 'Testov' not in xml or 'Anyko' not in xml:
            raise RuntimeError('Generated DOCX is missing synthetic fields')
    stop(process)
    process = None
    process, _ = start()
    kernel, handles = descendant_handles(process.pid)
    try:
        process.terminate()
        process.wait(timeout=30)
        process = None
        end = time.monotonic() + 30
        for handle in handles:
            remaining = max(0, int((end - time.monotonic()) * 1000))
            if kernel.WaitForSingleObject(handle, remaining) != 0:
                raise RuntimeError('A launcher child survived forced termination')
    finally:
        for handle in handles:
            kernel.CloseHandle(handle)
    process, _ = start()
    stop(process)
    process = None
    passed = True
    print('Relocated release: OCR, synthetic AI analysis, restart persistence and three DOCX files passed', flush=True)
finally:
    if provider:
        provider.shutdown()
        provider.server_close()
    if process and process.poll() is None:
        try:
            stop(process)
        except Exception:
            process.terminate()
            process.wait(timeout=30)
    if passed:
        shutil.rmtree(extended(temporary))
    else:
        print(f'Failed smoke files retained at {temporary}', file=sys.stderr, flush=True)
