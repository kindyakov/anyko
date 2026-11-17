import { sha256Hex } from '../../../platform/digest';

// Отпечаток входа повтора: SHA-256 канонической формы params, query и body (ADR 0009).
// Ключи объектов сортируются, поэтому порядок полей не меняет отпечаток. Файл входит именем и
// SHA-256 содержимого; значения полей в хранилище не попадают, только их отпечаток.
export async function fingerprintInput(input: {
  readonly params?: unknown;
  readonly query?: unknown;
  readonly body?: unknown;
}): Promise<string> {
  const canonical = await canonicalize({
    params: input.params,
    query: input.query,
    body: input.body,
  });
  return sha256Hex(new TextEncoder().encode(JSON.stringify(canonical)));
}

async function canonicalize(value: unknown): Promise<unknown> {
  if (value instanceof File)
    return {
      file: value.name,
      sha256: await sha256Hex(new Uint8Array(await value.arrayBuffer())),
    };
  if (Array.isArray(value)) return Promise.all(value.map(canonicalize));
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return Object.fromEntries(
      await Promise.all(
        entries.map(
          async ([key, item]) => [key, await canonicalize(item)] as const,
        ),
      ),
    );
  }
  return value;
}
