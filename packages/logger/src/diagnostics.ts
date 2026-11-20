type FailureDescription = {
  code: string;
  message: string;
  operation: string;
  causeCode?: string;
};

export type FailureDiagnostic = FailureDescription & {
  source?: readonly string[];
  operations: readonly string[];
  chain: readonly Readonly<
    FailureDescription & { source?: readonly string[] }
  >[];
};

type DiagnosticMetadata = {
  operation: string;
  cause: unknown;
  description?: Readonly<FailureDescription>;
};

// Next can bundle a route and its error hook with different copies of this module.
const registryKey = Symbol.for('@anyko/logger/diagnostics-v1');
const runtime = globalThis as typeof globalThis & {
  [registryKey]?: {
    prepared: WeakSet<FailureDiagnostic>;
    metadata: WeakMap<object, DiagnosticMetadata>;
  };
};
const registry = runtime[registryKey] ?? {
  prepared: new WeakSet(),
  metadata: new WeakMap(),
};
runtime[registryKey] = registry;
const { prepared, metadata } = registry;

export function isPreparedFailure(
  value: FailureDiagnostic | undefined,
): value is FailureDiagnostic {
  return value !== undefined && prepared.has(value);
}

function describe({
  code,
  message,
  operation,
  causeCode,
}: FailureDescription): FailureDescription {
  return {
    code,
    message: message.slice(0, 512),
    operation,
    ...(causeCode && { causeCode }),
  };
}

// Descriptions are authored in source. SDK exceptions stay private even when
// a framework inspects the error for its own output.
export class DiagnosticError extends Error {
  readonly description: Readonly<FailureDescription>;

  constructor(description: FailureDescription, options?: ErrorOptions) {
    super(description.message);
    this.description = Object.freeze(describe(description));
    metadata.set(this, {
      description: this.description,
      operation: this.description.operation,
      cause: options?.cause,
    });
  }
}

class OperationContext extends Error {
  constructor(operation: string, cause: unknown) {
    super(operation);
    metadata.set(this, { operation, cause });
  }
}

export async function inOperation<T>(
  operation: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new OperationContext(operation, error);
  }
}

function sourceFrames(error: Error): readonly string[] | undefined {
  const cwd = process.cwd().replaceAll('\\', '/');
  const root = cwd.replace(/\/(?:apps|packages)\/[^/]+(?:\/.*)?$/, '');
  const frames = new Set<string>();
  const stack = error.stack;
  if (typeof stack !== 'string') return undefined;
  // Skip the entire exception header, including multiline provider messages.
  const header = error.message ? `${error.name}: ${error.message}` : error.name;
  if (!stack.startsWith(`${header}\n`)) return undefined;
  const lines = stack.slice(header.length + 1).split('\n');
  for (const line of lines) {
    const normalized = line.replaceAll('\\', '/');
    if (!/^\s+at /u.test(normalized)) continue;
    const start = normalized.lastIndexOf(`${root}/`);
    if (start === -1) continue;
    const frame = normalized.slice(start + root.length + 1);
    const match =
      /^((?:apps|packages)\/[\w.@()[\]/-]+\.[cm]?[jt]sx?:\d+):\d+\)?$/u.exec(
        frame,
      );
    if (
      match?.[1] &&
      !frame.includes('/node_modules/') &&
      !frame.includes('/generated/') &&
      !frame.includes('/.next/')
    )
      frames.add(match[1]);
    if (frames.size === 3) break;
  }
  return frames.size ? Object.freeze([...frames]) : undefined;
}

export function diagnoseFailure(
  error: unknown,
  fallback: FailureDescription,
): FailureDiagnostic {
  const operations = [fallback.operation];
  const chain: FailureDiagnostic['chain'][number][] = [];
  let source: readonly string[] | undefined;
  const seen = new Set<object>();
  try {
    while (
      typeof error === 'object' &&
      error !== null &&
      seen.size < 8 &&
      !seen.has(error)
    ) {
      seen.add(error);
      const known = metadata.get(error);
      if (known) {
        operations.push(known.operation);
        if (known.description) {
          const frames =
            error instanceof Error ? sourceFrames(error) : undefined;
          chain.push(
            Object.freeze({
              ...known.description,
              ...(frames && { source: frames }),
            }),
          );
        }
        error = known.cause;
        continue;
      }
      if (!(error instanceof Error)) break;
      source = sourceFrames(error) ?? source;
      error = Object.getOwnPropertyDescriptor(error, 'cause')?.value as unknown;
    }
  } catch {
    // An exotic exception may throw from stack or prototype access.
  }
  const primary = chain.at(-1);
  const diagnostic = Object.freeze({
    ...describe(fallback),
    ...(source && { source }),
    ...primary,
    operations: Object.freeze([...new Set(operations)]),
    chain: Object.freeze(chain),
  });
  prepared.add(diagnostic);
  return diagnostic;
}

export function correlationId(
  value: string | null | undefined,
): string | undefined {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
    ? value.toLowerCase()
    : undefined;
}
