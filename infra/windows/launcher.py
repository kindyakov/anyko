"""Portable Windows supervisor. Data stays in the adjacent data directory."""
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import secrets
import signal
import socket
import struct
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser

ORIGINAL_ROOT = Path(__file__).resolve().parent


def windows_ascii_path(path):
    if str(path).isascii():
        return path
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.GetShortPathNameW.argtypes = [wintypes.LPCWSTR, wintypes.LPWSTR, wintypes.DWORD]
    kernel.GetShortPathNameW.restype = wintypes.DWORD
    buffer = ctypes.create_unicode_buffer(32768)
    size = kernel.GetShortPathNameW(str(path), buffer, len(buffer))
    if not size or size >= len(buffer) or not buffer.value.isascii():
        raise RuntimeError('Move the Anyko folder to a short path containing only Latin letters and digits')
    return Path(buffer.value)


ROOT = windows_ascii_path(ORIGINAL_ROOT)
DATA = ROOT / 'data'
INFRA = ROOT / 'infrastructure'
MIGRATOR = ROOT / 'migrator'
MINERU = ROOT / 'mineru'
WEB = ROOT / 'web'
COMPONENTS = ROOT / 'components'
CHILDREN = []
LOGS = []
KERNEL = JOB = None


class TcpRow(ctypes.Structure):
    _fields_ = [(name, wintypes.DWORD) for name in
                ('state', 'local_address', 'local_port', 'remote_address', 'remote_port', 'pid')]


def listener_owned(proc, port):
    api = ctypes.WinDLL('iphlpapi', use_last_error=True)
    api.GetExtendedTcpTable.argtypes = [ctypes.c_void_p, ctypes.POINTER(wintypes.DWORD),
                                        wintypes.BOOL, wintypes.ULONG, ctypes.c_int, wintypes.ULONG]
    size = wintypes.DWORD()
    result = api.GetExtendedTcpTable(None, ctypes.byref(size), False, 2, 3, 0)
    if result != 122:
        raise OSError(result, 'Cannot inspect local listeners')
    buffer = ctypes.create_string_buffer(size.value)
    result = api.GetExtendedTcpTable(buffer, ctypes.byref(size), False, 2, 3, 0)
    if result:
        raise OSError(result, 'Cannot inspect local listeners')
    count = wintypes.DWORD.from_buffer(buffer).value
    for index in range(count):
        row = TcpRow.from_buffer(buffer, ctypes.sizeof(wintypes.DWORD) + index * ctypes.sizeof(TcpRow))
        address = socket.inet_ntoa(struct.pack('<L', row.local_address))
        if socket.ntohs(row.local_port & 0xffff) == port and address == '127.0.0.1':
            return row.pid == proc.pid and proc.poll() is None
    return False


def wait_listener(proc, port, seconds=120):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        if proc.poll() is not None:
            raise RuntimeError(f'Process exited before binding port {port}')
        if listener_owned(proc, port):
            return
        time.sleep(.1)
    raise RuntimeError(f'Expected process did not bind port {port}')


class BasicLimits(ctypes.Structure):
    _fields_ = [('per_process', ctypes.c_longlong), ('per_job', ctypes.c_longlong),
                ('flags', wintypes.DWORD), ('minimum', ctypes.c_size_t),
                ('maximum', ctypes.c_size_t), ('active', wintypes.DWORD),
                ('affinity', ctypes.c_size_t), ('priority', wintypes.DWORD),
                ('scheduling', wintypes.DWORD)]


class IoCounters(ctypes.Structure):
    _fields_ = [(name, ctypes.c_ulonglong) for name in
                ('read_ops', 'write_ops', 'other_ops', 'read_bytes', 'write_bytes', 'other_bytes')]


class ExtendedLimits(ctypes.Structure):
    _fields_ = [('basic', BasicLimits), ('io', IoCounters),
                ('process_memory', ctypes.c_size_t), ('job_memory', ctypes.c_size_t),
                ('peak_process', ctypes.c_size_t), ('peak_job', ctypes.c_size_t)]


def create_job():
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    kernel.CreateJobObjectW.restype = wintypes.HANDLE
    kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    kernel.SetInformationJobObject.restype = wintypes.BOOL
    kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel.AssignProcessToJobObject.restype = wintypes.BOOL
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    job = kernel.CreateJobObjectW(None, None)
    limits = ExtendedLimits()
    limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    if not job or not kernel.SetInformationJobObject(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
        raise OSError(ctypes.get_last_error(), 'Cannot create process supervisor')
    # Put the supervisor itself in the job before any child is created. Every
    # descendant then enters the job atomically at process creation.
    if not kernel.AssignProcessToJobObject(job, kernel.GetCurrentProcess()):
        kernel.CloseHandle(job)
        raise OSError(ctypes.get_last_error(), 'Cannot supervise this process')
    return kernel, job


def create_mutex():
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateMutexW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR]
    kernel.CreateMutexW.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    name = 'Global\\Anyko-' + hashlib.sha256(str(ORIGINAL_ROOT).casefold().encode('utf8')).hexdigest()
    ctypes.set_last_error(0)
    mutex = kernel.CreateMutexW(None, False, name)
    error = ctypes.get_last_error()
    if not mutex:
        raise OSError(error, 'Cannot create application mutex')
    if error == 183:
        kernel.CloseHandle(mutex)
        raise RuntimeError('Anyko is already running from this folder')
    return kernel, mutex


def watch_parent(pid):
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel.WaitForSingleObject.restype = wintypes.DWORD
    handle = kernel.OpenProcess(0x100000, False, pid)  # SYNCHRONIZE
    if not handle:
        raise OSError(ctypes.get_last_error(), 'Cannot watch launcher process')
    def monitor():
        kernel.WaitForSingleObject(handle, 0xffffffff)
        # Parent death or a failed watch closes this process's Job handle.
        os._exit(1)
    threading.Thread(target=monitor, daemon=True).start()


def ports(count):
    held = []
    try:
        for _ in range(count):
            sock = socket.socket()
            sock.bind(('127.0.0.1', 0))
            held.append(sock)
        return [sock.getsockname()[1] for sock in held]
    finally:
        for sock in held:
            sock.close()


def invoke(args, env, cwd=ROOT, timeout=180, capture=False):
    proc = subprocess.Popen([str(arg) for arg in args], cwd=cwd, env=env,
                            stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL)
    try:
        output, _ = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
        raise
    return proc.returncode, output


def command(args, env, cwd=ROOT, timeout=180):
    code, _ = invoke(args, env, cwd, timeout)
    if code:
        raise RuntimeError(f'{Path(args[0]).name} failed (code {code})')


def start(name, args, env, kernel, job, cwd=ROOT):
    log = open(DATA / 'logs' / (name + '.log'), 'ab', buffering=0)
    LOGS.append(log)
    proc = subprocess.Popen([str(arg) for arg in args], cwd=cwd, env=env,
                            stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
    CHILDREN.append((name, proc))
    return proc


def wait_http(proc, url, seconds=120):
    end = time.monotonic() + seconds
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    while time.monotonic() < end:
        if proc.poll() is not None:
            raise RuntimeError('Process exited before ready: ' + url)
        try:
            with opener.open(url, timeout=1) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(.2)
    raise RuntimeError('Service did not become ready: ' + url)


def settings():
    path = DATA / 'settings.json'
    try:
        with path.open('x', encoding='utf8') as output:
            config = {'format': 1, 'dbuser': 'anyko_' + secrets.token_hex(12),
                      'dbname': 'anyko_' + secrets.token_hex(12),
                      'dbpassword': secrets.token_hex(24), 'redispassword': secrets.token_hex(24), 'auth': secrets.token_hex(32),
                      'encryption': secrets.token_hex(32), 's3access': 'anyko' + secrets.token_hex(8),
                      's3secret': secrets.token_hex(24), 'login': 'demo@anyko.local',
                      'password': secrets.token_urlsafe(24)}
            json.dump(config, output)
    except FileExistsError:
        config = json.loads(path.read_text(encoding='utf8'))
    if config.get('format') != 1 or any(not isinstance(config.get(k), str) or not config[k] for k in
                                        ('dbuser', 'dbname', 'dbpassword', 'redispassword', 'auth', 'encryption', 's3access', 's3secret', 'login', 'password')):
        raise RuntimeError('Invalid data/settings.json; data was not changed')
    if not all(c.isascii() and (c.islower() or c.isdigit() or c == '_') for c in config['dbuser'] + config['dbname']):
        raise RuntimeError('Invalid database names in settings')
    credentials = DATA / 'login.txt'
    if not credentials.exists():
        with credentials.open('x', encoding='utf8') as output:
            output.write(f"Login: {config['login']}\nPassword: {config['password']}\n")
    return config


def run():
    global KERNEL, JOB
    for directory, version in [(INFRA, 1), (MIGRATOR, 2), (MINERU, 1)]:
        if json.loads((directory/'complete.json').read_text(encoding='utf8')).get('format') != version:
            raise RuntimeError('Incomplete component: ' + str(directory))
    DATA.mkdir(exist_ok=True)
    (DATA/'logs').mkdir(exist_ok=True)
    mutex_kernel, mutex = create_mutex()
    kernel = job = None
    pgdata = DATA/'postgres'
    pg = INFRA/'postgresql/pgsql/bin'
    database = None
    env = None
    try:
        config = settings()
        kernel, job = create_job()
        KERNEL, JOB = kernel, job
        pgport, redisport, s3port, ocrport, apiport, workerport, webport = ports(7)
        systemroot = os.environ['SystemRoot']
        temp = DATA/'temp'
        appdata = DATA/'appdata'
        temp.mkdir(exist_ok=True)
        appdata.mkdir(exist_ok=True)
        origin = f'http://127.0.0.1:{webport}'
        base = {'SystemRoot': systemroot, 'PATH': str(Path(systemroot)/'System32'),
                'TEMP': str(temp), 'TMP': str(temp), 'USERPROFILE': str(DATA),
                'APPDATA': str(appdata), 'LOCALAPPDATA': str(appdata), 'PYTHONUTF8': '1'}
        database_url = f"postgresql://{config['dbuser']}:{config['dbpassword']}@127.0.0.1:{pgport}/{config['dbname']}"
        env = {**base, 'PGPASSWORD': config['dbpassword'], 'DATABASE_URL': database_url}
        storage_env = {**base, 'S3_ENDPOINT': f'http://127.0.0.1:{s3port}', 'S3_BUCKET': 'anyko-local',
                       'S3_ACCESS_KEY': config['s3access'], 'S3_SECRET_KEY': config['s3secret']}
        work_env = {**storage_env, 'DATABASE_URL': database_url, 'DOCUMENTS_ENABLED': 'true',
                    'WORKS_ENABLED': 'true', 'LLM_CONFIG_ENCRYPTION_KEY': config['encryption'],
                    'REDIS_URL': f"redis://:{config['redispassword']}@127.0.0.1:{redisport}",
                    'MINERU_BASE_URL': f'http://127.0.0.1:{ocrport}', 'NODE_ENV': 'production'}
        api_env = {**work_env, 'AUTH_SECRET': config['auth'], 'AUTH_BASE_URL': origin,
                   'APP_ORIGIN': origin, 'API_PORT': str(apiport)}
        worker_env = {**work_env, 'WORKER_PORT': str(workerport), 'SHUTDOWN_TIMEOUT_MS': '300000'}
        for name in ('HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'):
            if os.environ.get(name):
                worker_env[name] = os.environ[name]
        no_proxy = ','.join(filter(None, (os.environ.get('NO_PROXY'), os.environ.get('no_proxy'), '127.0.0.1,localhost,::1')))
        worker_env.update({'NO_PROXY': no_proxy, 'no_proxy': no_proxy})
        provision_env = {**env, 'AUTH_SECRET': config['auth'], 'AUTH_BASE_URL': origin,
                         'APP_ORIGIN': origin, 'LOCAL_USER_EMAIL': config['login'],
                         'LOCAL_USER_PASSWORD': config['password']}
        web_env = {**base, 'API_ORIGIN': f'http://127.0.0.1:{apiport}', 'APP_ORIGIN': origin,
                   'PORT': str(webport), 'HOSTNAME': '127.0.0.1', 'NODE_ENV': 'production'}
        if not (pgdata/'PG_VERSION').exists():
            if pgdata.exists() and any(pgdata.iterdir()):
                raise RuntimeError('Incomplete PostgreSQL directory; data was not changed')
            pwfile = DATA/'postgres-password.txt'
            if not pwfile.exists():
                with pwfile.open('x', encoding='utf8') as output:
                    output.write(config['dbpassword'])
            elif pwfile.read_text(encoding='utf8') != config['dbpassword']:
                raise RuntimeError('PostgreSQL password file does not match settings')
            print('Preparing local database...', flush=True)
            command([pg/'initdb.exe', '-D', pgdata, '-U', config['dbuser'], '--pwfile', pwfile,
                     '--auth', 'scram-sha-256', '--encoding', 'UTF8', '--locale=C'], env)
        database = start('postgres', [pg/'postgres.exe', '-D', pgdata, '-h', '127.0.0.1', '-p', str(pgport)], env, kernel, job)
        wait_listener(database, pgport)
        args = [str(pg/'psql.exe'), '-h', '127.0.0.1', '-p', str(pgport), '-U', config['dbuser'], '-d', 'postgres', '-Atc', 'select 1']
        for _ in range(150):
            if database.poll() is not None:
                raise RuntimeError('PostgreSQL failed to start')
            code, output = invoke(args, env, timeout=3, capture=True)
            if code == 0:
                with (pgdata/'postmaster.pid').open('rb') as pidfile:
                    owner_pid = int(pidfile.readline())
                if output.strip() != b'1' or owner_pid != database.pid or not listener_owned(database, pgport):
                    raise RuntimeError('Unexpected PostgreSQL instance')
                break
            time.sleep(.2)
        else:
            raise RuntimeError('PostgreSQL did not become ready')
        code, output = invoke(args[:-1] + [f"select 1 from pg_database where datname = '{config['dbname']}'"], env, timeout=10, capture=True)
        if code:
            raise RuntimeError('Cannot inspect local database')
        if output.strip() != b'1':
            command([pg/'createdb.exe', '-h', '127.0.0.1', '-p', str(pgport), '-U', config['dbuser'], config['dbname']], env)
        command([MIGRATOR/'bun.exe', MIGRATOR/'node_modules/prisma/build/index.js', 'migrate', 'deploy'], env, MIGRATOR/'packages/database')
        command([COMPONENTS/'anyko-provision-access.exe'], provision_env)
        redisdata = DATA/'redis'
        redisdata.mkdir(exist_ok=True)
        redisenv = {**base, 'REDISCLI_AUTH': config['redispassword']}
        redisconfig = redisdata/'redis.conf'
        if not redisconfig.exists():
            with redisconfig.open('x', encoding='utf8') as output:
                output.write(f"requirepass {config['redispassword']}\n")
        elif redisconfig.read_text(encoding='utf8') != f"requirepass {config['redispassword']}\n":
            raise RuntimeError('Redis configuration does not match settings')
        redis = start('redis', [INFRA/'redis/Redis-8.10.3-Windows-x64-msys2/redis-server.exe', 'redis.conf', '--bind', '127.0.0.1', '--port', str(redisport), '--appendonly', 'yes', '--dir', '.'], redisenv, kernel, job, redisdata)
        wait_listener(redis, redisport)
        s3data = DATA/'storage'
        s3data.mkdir(exist_ok=True)
        s3env = {**base, 'RUSTFS_ACCESS_KEY': config['s3access'], 'RUSTFS_SECRET_KEY': config['s3secret'], 'RUSTFS_CONSOLE_ENABLE': 'false', 'RUSTFS_OBS_LOGGER_LEVEL': 'error'}
        s3 = start('storage', [INFRA/'rustfs/rustfs.exe', 'server', '--address', f'127.0.0.1:{s3port}', s3data], s3env, kernel, job)
        wait_listener(s3, s3port)
        wait_http(s3, storage_env['S3_ENDPOINT']+'/health')
        command([COMPONENTS/'anyko-prepare-storage.exe'], storage_env)
        metadata = json.loads((MINERU/'complete.json').read_text(encoding='utf8'))
        python_relative = Path(metadata['python'])
        if python_relative.is_absolute() or '..' in python_relative.parts:
            raise RuntimeError('Invalid bundled Python path')
        python = MINERU/python_relative
        ocrenv = {**base, 'MINERU_HOME': str(MINERU/'home'), 'HF_HOME': str(DATA/'hf'), 'HF_HUB_OFFLINE': '1',
                  'HF_HUB_DISABLE_XET': '1', 'MINERU_TELEMETRY_DISABLED': '1', 'ANYKO_PROCESSOR_ROOT': str(DATA/'processor'),
                  'ANYKO_OCR_PORT': str(ocrport)}
        ocr = start('ocr', [python, '-B', MINERU/'serve_processor.py'], ocrenv, kernel, job, MINERU)
        wait_listener(ocr, ocrport)
        wait_http(ocr, work_env['MINERU_BASE_URL']+'/v1/health', 180)
        api = start('api', [COMPONENTS/'anyko-api.exe'], api_env, kernel, job)
        worker = start('worker', [COMPONENTS/'anyko-worker.exe'], worker_env, kernel, job)
        wait_listener(api, apiport)
        wait_listener(worker, workerport)
        wait_http(api, f'http://127.0.0.1:{apiport}/health/ready')
        wait_http(worker, f'http://127.0.0.1:{workerport}/health/ready')
        command([WEB/'bun.exe', 'restore-windows-web-links.mjs', '.'], base, WEB)
        web = start('web', [WEB/'bun.exe', WEB/'apps/web/server.js'], web_env, kernel, job)
        wait_listener(web, webport)
        wait_http(web, origin+'/')
        print(f'Anyko: {origin}\nLogin details: {DATA / "login.txt"}\nPress Enter to stop.', flush=True)
        if os.environ.get('ANYKO_NO_BROWSER') != '1':
            webbrowser.open(origin)
        finished = threading.Event()
        threading.Thread(target=lambda: (sys.stdin.readline(), finished.set()), daemon=True).start()
        watched = [(database, pgport), (redis, redisport), (s3, s3port), (ocr, ocrport),
                   (api, apiport), (worker, workerport), (web, webport)]
        while not finished.wait(1):
            if any(not listener_owned(process, port) for process, port in watched):
                raise RuntimeError('A local service stopped unexpectedly')
    finally:
        # Stop accepting new work before draining the worker and processor.
        order = ('web', 'api', 'worker', 'ocr', 'storage', 'redis', 'postgres')
        for name, proc in sorted(CHILDREN, key=lambda child: order.index(child[0])):
            if proc.poll() is not None:
                continue
            if name == 'postgres':
                try:
                    command([pg/'pg_ctl.exe', '-D', pgdata, '-m', 'fast', '-w', 'stop'], env, timeout=30)
                except Exception:
                    proc.terminate()
            elif name == 'redis':
                try:
                    command([INFRA/'redis/Redis-8.10.3-Windows-x64-msys2/redis-cli.exe', '-h', '127.0.0.1', '-p', str(redisport), 'shutdown'], redisenv, timeout=30)
                except Exception:
                    proc.terminate()
            else:
                try:
                    proc.send_signal(signal.CTRL_BREAK_EVENT)
                    proc.wait(timeout=310 if name in ('worker', 'ocr') else 15)
                except (OSError, subprocess.TimeoutExpired):
                    proc.terminate()
            try:
                proc.wait(timeout=30)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
        # Keep the job handle open until Python exits: closing it here would
        # terminate the supervisor itself before it can report its result.
        for log in LOGS:
            log.close()
        mutex_kernel.CloseHandle(mutex)


if __name__ == '__main__':
    try:
        if len(sys.argv) != 2 or not sys.argv[1].isdigit():
            raise RuntimeError('Launch Anyko.exe instead of running this file directly')
        watch_parent(int(sys.argv[1]))
        run()
    except (Exception, KeyboardInterrupt) as error:
        print(f'Anyko stopped: {error}', file=sys.stderr, flush=True)
        sys.exit(1)
