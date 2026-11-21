import { expect, test } from 'bun:test';

import { observeProviderFetch } from './provider-calls';
import { watchProviderStream } from './provider-stream';

import { llmError } from './index';

const encoder = new TextEncoder();

function event(delta: object) {
  return `data: ${JSON.stringify({ choices: [{ delta }] })}\r\n\r\n`;
}

test('processing comments do not prevent an idle abort or lose the partial provider history', async () => {
  let comments: ReturnType<typeof setInterval> | undefined;
  let cancelled = false;
  const upstream = Object.assign(
    () =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(event({ reasoning: 'часть рассуждения' })),
              );
              comments = setInterval(() => {
                controller.enqueue(encoder.encode(': PROCESSING\r\n\r\n'));
              }, 5);
            },
            cancel() {
              cancelled = true;
              clearInterval(comments);
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      ),
    { preconnect: fetch.preconnect },
  );
  let recorded: unknown;
  const transport = observeProviderFetch(
    watchProviderStream(upstream, 60),
    () =>
      Promise.resolve((result) => {
        recorded = result;
        return Promise.resolve();
      }),
  );
  try {
    const response = await transport(
      'https://fixture.invalid/chat/completions',
    );
    const failure = await response.text().catch((error: unknown) => error);
    expect(llmError(failure).code).toBe('LLM_STREAM_IDLE');
    expect(recorded).toMatchObject({
      status: 'failed',
      errorCode: 'LLM_STREAM_IDLE',
      reasoningTokens: null,
    });
    expect(JSON.stringify(recorded)).not.toContain('часть рассуждения');
    expect(cancelled).toBe(true);
  } finally {
    clearInterval(comments);
  }
});

test('reasoning and content deltas extend the deadline while their bytes pass through', async () => {
  const reasoning = event({ reasoning: 'материал' });
  const answer = event({ content: 'ответ' });
  const upstream = Object.assign(
    () =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            async start(controller) {
              await Bun.sleep(125);
              controller.enqueue(encoder.encode(reasoning.slice(0, 17)));
              controller.enqueue(encoder.encode(reasoning.slice(17)));
              await Bun.sleep(125);
              controller.enqueue(encoder.encode(answer));
              await Bun.sleep(125);
              controller.close();
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      ),
    { preconnect: fetch.preconnect },
  );
  const response = await watchProviderStream(
    upstream,
    220,
  )('https://fixture.invalid/chat/completions');
  expect(await response.text()).toBe(reasoning + answer);
});
