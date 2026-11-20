import { z } from 'zod';

import type { FieldValue } from '@anyko/contracts/catalog';

const completionRequest = z.object({
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
    const { messages, tools } = completionRequest.parse(await request.json());
    const last = messages.at(-1);
    const value =
      last?.role === 'user'
        ? values.get(
            userMessage.parse(JSON.parse(z.string().parse(last.content)))
              .message,
          )
        : undefined;
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
    return Response.json({
      id: 'e2e-chat-completion',
      object: 'chat.completion',
      created: 1,
      model: 'e2e-fixture',
      choices: [
        { index: 0, message, finish_reason: isWrite ? 'tool_calls' : 'stop' },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
  },
  { preconnect: fetch.preconnect },
);
