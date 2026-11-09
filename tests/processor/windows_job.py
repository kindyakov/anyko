"""Prove Windows job cleanup and named mutex release after supervisor crash."""
import ctypes
from ctypes import wintypes
import importlib.util
import json
from pathlib import Path
import queue
import subprocess
import sys
import tempfile
import threading
import time

SCRIPT = Path(__file__).resolve()
LAUNCHER = SCRIPT.parents[2]/'infra/windows/launcher.py'


def supervisor(marker):
    spec = importlib.util.spec_from_file_location('anyko_windows_launcher', LAUNCHER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    mutex_kernel, mutex = module.create_mutex()
    kernel, job = module.create_job()
    child = subprocess.Popen([sys.executable, '-B', str(SCRIPT), 'child', str(marker)],
                             stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    while not marker.exists():
        if child.poll() is not None:
            raise RuntimeError('Child exited')
        time.sleep(.05)
    print('ready', flush=True)
    time.sleep(300)
    # Keep both handles alive for the lifetime of this supervisor.
    return mutex_kernel, mutex, kernel, job


def child(marker):
    grandchild = subprocess.Popen([sys.executable, '-B', str(SCRIPT), 'grandchild'],
                                 stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    marker.write_text(json.dumps({'child': __import__('os').getpid(), 'grandchild': grandchild.pid}))
    time.sleep(300)


def dead(pid):
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel.WaitForSingleObject.restype = wintypes.DWORD
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel.OpenProcess(0x100000, False, pid)  # SYNCHRONIZE
    if not handle:
        error = ctypes.get_last_error()
        if error == 87:  # no such PID
            return True
        raise OSError(error, 'Cannot inspect child process')
    try:
        result = kernel.WaitForSingleObject(handle, 0)
        if result == 0:
            return True
        if result == 258:
            return False
        raise OSError(ctypes.get_last_error(), 'Cannot wait for child process')
    finally:
        kernel.CloseHandle(handle)


def main():
    with tempfile.TemporaryDirectory(prefix='anyko-job-test-') as temp:
        marker = Path(temp)/'children.json'
        def launch(path):
            return subprocess.Popen([sys.executable, '-u', '-B', str(SCRIPT), 'supervisor', str(path)],
                                    stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        def wait_ready(process):
            lines = queue.Queue()
            threading.Thread(target=lambda: lines.put(process.stdout.readline()), daemon=True).start()
            try:
                return lines.get(timeout=30).strip() == 'ready'
            except queue.Empty:
                return False
        first = launch(marker)
        try:
            if not wait_ready(first):
                raise RuntimeError('Supervisor failed to start')
            pids = json.loads(marker.read_text())
            duplicate = launch(Path(temp)/'duplicate.json')
            try:
                duplicate.wait(timeout=30)
                if (duplicate.returncode == 0 or (Path(temp)/'duplicate.json').exists()
                        or 'Anyko is already running from this folder' not in duplicate.stderr.read()):
                    raise RuntimeError('Concurrent supervisor was not rejected')
            finally:
                if duplicate.poll() is None:
                    duplicate.terminate()
                    duplicate.wait(timeout=30)
        finally:
            first.terminate()
            first.wait(timeout=30)
        end = time.monotonic() + 30
        while time.monotonic() < end and not all(dead(pid) for pid in pids.values()):
            time.sleep(.1)
        if not all(dead(pid) for pid in pids.values()):
            raise RuntimeError('Job descendants survived supervisor termination')
        second = launch(Path(temp)/'second.json')
        try:
            if not wait_ready(second):
                raise RuntimeError('Mutex did not release after crash')
            second_pids = json.loads((Path(temp)/'second.json').read_text())
        finally:
            second.terminate()
            second.wait(timeout=30)
        end = time.monotonic() + 30
        while time.monotonic() < end and not all(dead(pid) for pid in second_pids.values()):
            time.sleep(.1)
        if not all(dead(pid) for pid in second_pids.values()):
            raise RuntimeError('Restarted supervisor left descendants')
        print('Crash cleanup and mutex release passed', flush=True)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'supervisor':
        supervisor(Path(sys.argv[2]))
    elif len(sys.argv) > 1 and sys.argv[1] == 'child':
        child(Path(sys.argv[2]))
    elif len(sys.argv) > 1 and sys.argv[1] == 'grandchild':
        time.sleep(300)
    else:
        main()
