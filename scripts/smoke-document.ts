import { basename } from 'node:path';

import { z } from 'zod';

import {
  documentResponseSchema,
  documentResultSchema,
  sessionResponseSchema,
} from '@anyko/contracts';
const config = z
  .object({
    LOCAL_USER_EMAIL: z.email(),
    LOCAL_USER_PASSWORD: z.string().min(1),
    APP_ORIGIN: z.url().default('http://anyko.localhost:3020'),
  })
  .parse(process.env);
const origin = config.APP_ORIGIN;
let cookie = '';
async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set('cookie', cookie);
  if (init.method && init.method !== 'GET') headers.set('origin', origin);
  return fetch(`${origin}/api${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(30000),
  });
}
function assert(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}
try {
  assert(
    (await request('/documents')).status === 401,
    'ANONYMOUS_ACCESS_NOT_DENIED',
  );
  const login = await request('/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: config.LOCAL_USER_EMAIL,
      password: config.LOCAL_USER_PASSWORD,
    }),
  });
  assert(login.ok, 'LOGIN_FAILED');
  cookie = login.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ');
  await login.body?.cancel();
  assert(cookie, 'SESSION_COOKIE_MISSING');
  const session = await request('/session');
  assert(session.ok, 'SESSION_FAILED');
  sessionResponseSchema.parse(await session.json());
  const fixture = process.argv[2] ?? 'work/mineru/smoke-basic.pdf';
  const filename = basename(fixture);
  const file = await Bun.file(fixture).bytes();
  const key = crypto.randomUUID();
  const upload = async (bytes: Uint8Array) => {
    const form = new FormData();
    form.append('file', new File([Uint8Array.from(bytes)], filename));
    return request('/documents', {
      method: 'POST',
      headers: { 'idempotency-key': key },
      body: form,
    });
  };
  const accepted = await upload(file);
  assert(accepted.status === 202, 'UPLOAD_NOT_ACCEPTED');
  const first = documentResponseSchema.parse(await accepted.json()).document;
  const duplicate = await upload(file);
  assert(duplicate.status === 202, 'DUPLICATE_NOT_ACCEPTED');
  assert(
    documentResponseSchema.parse(await duplicate.json()).document.id ===
      first.id,
    'IDEMPOTENCY_FAILED',
  );
  const changed = new Uint8Array([...file, 10]);
  assert(
    (await upload(changed)).status === 409,
    'IDEMPOTENCY_CONFLICT_NOT_REJECTED',
  );
  const end = Date.now() + 180000;
  let status = first.status;
  while (Date.now() < end) {
    const response = await request(`/documents/${first.id}`);
    assert(response.ok, 'STATUS_QUERY_FAILED');
    status = documentResponseSchema.parse(await response.json()).document
      .status;
    if (status === 'succeeded' || status === 'failed') break;
    await Bun.sleep(1000);
  }
  assert(status === 'succeeded', 'OCR_DID_NOT_SUCCEED');
  const result = await request(`/documents/${first.id}/result`);
  assert(result.ok, 'RESULT_QUERY_FAILED');
  const parsed = documentResultSchema.parse(await result.json());
  assert(parsed.markdown.includes('ANYKO'), 'OCR_MARKER_MISSING');
  console.info(
    JSON.stringify({
      anonymousDenied: true,
      session: true,
      documentId: first.id,
      filename,
      idempotency: true,
      conflictRejected: true,
      status,
      processorVersion: parsed.processorVersion,
      ocrMarker: true,
    }),
  );
  await Bun.write(
    `work/document-smoke-${filename}.json`,
    JSON.stringify({
      documentId: first.id,
      status,
      processorVersion: parsed.processorVersion,
    }),
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'DOCUMENT_SMOKE_FAILED',
  );
  process.exitCode = 1;
}
