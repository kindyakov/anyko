import { runDiagnostic } from '@anyko/backend/runtime';
import { parseWorkerConfig } from './config';
try {
  const config = parseWorkerConfig(process.env);
  console.info(
    JSON.stringify(
      await runDiagnostic({
        redisUrl: config.REDIS_URL,
        queueName: config.QUEUE_NAME,
        timeoutMs: config.STARTUP_TIMEOUT_MS,
        correlationId: crypto.randomUUID(),
      }),
    ),
  );
} catch {
  console.error('DIAGNOSTIC_FAILED');
  process.exitCode = 1;
}
