export function completionStream({
  choices,
  usage,
  ...metadata
}: {
  id: string;
  object?: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role?: string;
      content?: string | null;
      reasoning_content?: string;
      tool_calls?: object[];
    };
    finish_reason: string;
  }[];
  usage?: unknown;
}) {
  const envelope = { ...metadata, object: 'chat.completion.chunk' };
  const frames = [
    {
      ...envelope,
      choices: choices.map(({ index, message }) => ({
        index,
        delta: {
          ...message,
          ...(message.tool_calls && {
            tool_calls: message.tool_calls.map((call, index) => ({
              ...call,
              index,
            })),
          }),
        },
        finish_reason: null,
      })),
    },
    {
      ...envelope,
      choices: choices.map(({ index, finish_reason }) => ({
        index,
        delta: {},
        finish_reason,
      })),
      usage,
    },
  ];
  return new Response(
    frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join('') +
      'data: [DONE]\n\n',
    {
      headers: { 'content-type': 'text/event-stream' },
    },
  );
}
