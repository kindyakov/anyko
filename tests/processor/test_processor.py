import asyncio
import importlib.util
import os
import subprocess
from pathlib import Path
import tempfile
import threading
import unittest
import uuid

from fastapi import HTTPException
import httpx
from importlib.metadata import distribution
sdk_spec = importlib.util.spec_from_file_location('sdk_async', distribution('mineru').locate_file('mineru/utils/async_utils.py'))
sdk_async = importlib.util.module_from_spec(sdk_spec)
sdk_spec.loader.exec_module(sdk_async)
run_sync = sdk_async.run_sync

spec = importlib.util.spec_from_file_location('review_processor', Path('infra/mineru/processor.py').resolve())
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

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

if __name__ == '__main__':
    unittest.main()
