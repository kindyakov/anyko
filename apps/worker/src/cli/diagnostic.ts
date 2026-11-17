import { uuidV7 } from '@anyko/backend/ids';

import { parseWorkerConfig } from '../bootstrap/config';
import { runDiagnostic } from '../queues/diagnostic-client';
try {
  const config = parseWorkerConfig(process.env);
  console.info(
    JSON.stringify(
      await runDiagnostic({
        redisUrl: config.REDIS_URL,
        queueName: config.QUEUE_NAME,
        timeoutMs: config.STARTUP_TIMEOUT_MS,
        correlationId: uuidV7(),
      }),
    ),
  );
} catch {
  console.error('DIAGNOSTIC_FAILED');
  process.exitCode = 1;
}
