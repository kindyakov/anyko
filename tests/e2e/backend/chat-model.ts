import { z } from 'zod';

import type { FieldValue } from '@anyko/contracts/catalog';

const completionRequest = z.object({
  stream: z.boolean().optional(),
  messages: z.array(
    z.object({
      role: z.string(),
      content: z.unknown(),
      tool_call_id: z.string().optional(),
    }),
  ),
  tools: z
    .array(z.object({ function: z.object({ name: z.string() }) }))
    .optional(),
});

const toolCallId = 'e2e-set-last-name';
const userMessage = z.object({ message: z.string() });
const values = new Map<string, FieldValue>([
  ['Поменяйте фамилию на Петрова.', 'Петрова'],
  ['Запишите таблицу в поле фамилии.', [{}]],
]);

export const chatModelFetch = Object.assign(
  async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const request = new Request(url, init);
    const { messages, tools, stream } = completionRequest.parse(
      await request.json(),
    );
    const last = messages.at(-1);
    const userText =
      last?.role === 'user'
        ? userMessage.parse(JSON.parse(z.string().parse(last.content))).message
        : undefined;
    const value = userText === undefined ? undefined : values.get(userText);
    const isWrite = value !== undefined;
    if (
      isWrite &&
      !tools?.some((tool) => tool.function.name === 'setWorkField')
    )
      throw new Error('E2E_WRITE_TOOL_NOT_AVAILABLE');
    const message = isWrite
      ? {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: toolCallId,
              type: 'function',
              function: {
                name: 'setWorkField',
                arguments: JSON.stringify({
                  field: 'lastName',
                  value,
                }),
              },
            },
          ],
        }
      : {
          role: 'assistant',
          content:
            last?.tool_call_id === toolCallId
              ? 'Фамилия обновлена.'
              : 'Могу помочь проверить сведения работы.',
        };
    const response = {
      id: 'e2e-chat-completion',
      object: 'chat.completion',
      created: 1,
      model: 'e2e-fixture',
      choices: [
        { index: 0, message, finish_reason: isWrite ? 'tool_calls' : 'stop' },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
    if (!stream) return Response.json(response);
    const paced = userText === 'Проверьте потоковый ответ.';
    const { id, created, model, usage } = response;
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(output) {
          const emit = (delta: object, finish_reason: string | null = null) => {
            output.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id,
                  created,
                  model,
                  object: 'chat.completion.chunk',
                  choices: [{ index: 0, delta, finish_reason }],
                })}\n\n`,
              ),
            );
          };
          try {
            emit({ role: 'assistant' });
            if (paced) {
              emit({ reasoning_content: 'Проверяю доступные сведения.' });
              await Bun.sleep(400);
              emit({ content: '**Первая часть**' });
              await Bun.sleep(5000);
              emit({ content: '\n\nВторая часть.' });
              await Bun.sleep(7500);
              emit({ content: '\n\nОтвет завершён.' });
            } else if (message.tool_calls) {
              emit({
                tool_calls: message.tool_calls.map((call, index) => ({
                  ...call,
                  index,
                })),
              });
            } else {
              emit({ content: message.content });
            }
            emit({}, isWrite ? 'tool_calls' : 'stop');
            output.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ id, created, model, choices: [], usage })}\n\ndata: [DONE]\n\n`,
              ),
            );
            output.close();
          } catch (error) {
            output.error(error);
          }
        },
      }),
      { headers: { 'content-type': 'text/event-stream' } },
    );
  },
  { preconnect: fetch.preconnect },
);
