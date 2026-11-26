import pino, { type DestinationStream } from 'pino';

import { type FailureDiagnostic, isPreparedFailure } from './diagnostics';

export {
  correlationId,
  DiagnosticError,
  diagnoseFailure,
  inOperation,
} from './diagnostics';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export interface LogEvent {
  event: string;
  requestId?: string | undefined;
  correlationId?: string | undefined;
  jobId?: string | undefined;
  documentId?: string | undefined;
  jobType?: string | undefined;
  attempt?: number | undefined;
  method?: string;
  route?: string | undefined;
  statusCode?: number;
  durationMs?: number;
  errorCode?: string | undefined;
  errorDigest?: string | undefined;
  failure?: FailureDiagnostic;
  state?: string;
  port?: number;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  field?: string;
  templateVersion?: string;
  rejectedCount?: number;
}
export interface Logger {
  debug: (fields: LogEvent) => void;
  info: (fields: LogEvent) => void;
  warn: (fields: LogEvent) => void;
  error: (fields: LogEvent) => void;
  fatal: (fields: LogEvent) => void;
}
const fields = [
  'event',
  'requestId',
  'correlationId',
  'jobId',
  'documentId',
  'jobType',
  'attempt',
  'method',
  'route',
  'statusCode',
  'durationMs',
  'errorCode',
  'errorDigest',
  'state',
  'port',
  'provider',
  'model',
  'inputTokens',
  'outputTokens',
  'field',
  'templateVersion',
  'rejectedCount',
] as const;
/** Never serialize arbitrary request objects or Error messages. */
export function createLogger(
  config: {
    service: string;
    environment: string;
    release: string;
    level: LogLevel;
  },
  destination?: DestinationStream,
): Logger {
  const output = pino(
    {
      level: config.level,
      base: {
        schemaVersion: 1,
        service: config.service,
        environment: config.environment,
        release: config.release,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination ?? pino.destination({ dest: 1, sync: true }),
  );
  function write(level: LogLevel, input: LogEvent) {
    const safe: Record<string, string | number> = {};
    for (const key of fields) {
      const value = input[key];
      if (typeof value === 'number' && Number.isFinite(value))
        safe[key] = value;
      else if (typeof value === 'string') safe[key] = value.slice(0, 256);
    }
    output[level]({
      ...safe,
      ...(isPreparedFailure(input.failure) && { failure: input.failure }),
    });
  }
  return {
    debug: (e) => {
      write('debug', e);
    },
    info: (e) => {
      write('info', e);
    },
    warn: (e) => {
      write('warn', e);
    },
    error: (e) => {
      write('error', e);
    },
    fatal: (e) => {
      write('fatal', e);
    },
  };
}
