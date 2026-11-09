"""Expose the existing processor while supporting Windows console shutdown."""
import asyncio
import os
import signal

import uvicorn

if __name__ == '__main__':
    # Proactor transport shutdown can leave wait_closed pending after a TCP reset.
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    config = uvicorn.Config('processor:app', host='127.0.0.1', port=int(os.environ['ANYKO_OCR_PORT']),
                            workers=1, log_level='warning', access_log=False,
                            timeout_graceful_shutdown=10)
    server = uvicorn.Server(config)
    signal.signal(signal.SIGBREAK, lambda _signum, _frame: setattr(server, 'should_exit', True))
    server.run()
