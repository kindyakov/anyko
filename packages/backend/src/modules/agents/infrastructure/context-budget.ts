import { TripWire } from '@mastra/core/agent';
import {
  type ProcessLLMRequestArgs,
  type Processor,
  TokenLimiterProcessor,
} from '@mastra/core/processors';

import { LlmError, type ModelContextLimits } from '@anyko/llm';

const fallback: ModelContextLimits = {
  context: 16384,
  prompt: 12288,
  completion: 4096,
};

type Prompt = ProcessLLMRequestArgs['prompt'];

function latestToolCalls(prompt: Prompt, current: Prompt[number]) {
  const currentIndex = prompt.indexOf(current);
  for (let index = prompt.length - 1; index > currentIndex; index--) {
    const message = prompt[index];
    if (message?.role !== 'assistant') continue;
    const calls = message.content.filter((part) => part.type === 'tool-call');
    if (calls.length) return { message, index, calls };
  }
  return null;
}

function* smallerToolBatches<T>(calls: T[]) {
  if (calls.length < 2) return;
  for (
    let count = Math.floor(calls.length / 2);
    count > 1;
    count = Math.floor(count / 2)
  )
    yield calls.slice(0, count);

  // Results can differ substantially in size, including the last page of a source.
  for (const call of calls) yield [call];
}

export function createWorkContextBudget(limits: ModelContextLimits | null) {
  const { context, prompt, completion } = limits ?? fallback;
  const maxOutputTokens = Math.min(12000, completion, Math.floor(context / 4));
  // Tool schemas and structured output are sent outside the message list.
  const promptCapacity = Math.min(prompt, context - maxOutputTokens) - 2048;
  // Mastra estimates message tokens independently of the provider tokenizer.
  const promptTokens = Math.min(32000, Math.floor(promptCapacity * 0.85));
  if (promptTokens < 1024) throw new LlmError('LLM_REQUEST_REJECTED');
  const limiter = new TokenLimiterProcessor(promptTokens);
  let rejected = false;
  const reject = (): never => {
    rejected = true;
    throw new LlmError('LLM_REQUEST_REJECTED');
  };
  const processor = {
    id: 'work-context-budget',
    async processLLMRequest(args) {
      const current = [...args.prompt]
        .reverse()
        .find((message) => message.role === 'user');
      if (!current) return reject();

      // Mastra selects recent messages first. Reserve the current request before older turns
      // and tool results, then emit retained messages in their original order.
      const limit = async (prompt: Prompt) => {
        const prioritized = prompt.filter((message) => message !== current);
        prioritized.push(current);
        const result = await limiter
          .processLLMRequest({
            ...args,
            prompt: prioritized,
          })
          .catch((error: unknown) => {
            if (error instanceof TripWire) return reject();
            throw error;
          });
        const retained = new Set(result?.prompt ?? prioritized);
        if (!retained.has(current)) return reject();
        return retained;
      };
      const retained = await limit(args.prompt);
      const latest = latestToolCalls(args.prompt, current);
      if (!latest || retained.has(latest.message))
        return {
          prompt: args.prompt.filter((message) => retained.has(message)),
        };

      // Mastra keeps a parallel batch as one group. If it cannot fit, keep a
      // smaller batch of complete calls/results in the provider request only.
      for (const calls of smallerToolBatches(latest.calls)) {
        const ids = new Set(calls.map(({ toolCallId }) => toolCallId));
        const assistant = { ...latest.message, content: calls };
        const prompt = [
          ...args.prompt.slice(0, latest.index),
          assistant,
          ...args.prompt
            .slice(latest.index + 1)
            .flatMap<Prompt[number]>((message) => {
              if (message.role !== 'tool') return [message];
              const content = message.content.filter(({ toolCallId }) =>
                ids.has(toolCallId),
              );
              return content.length ? [{ ...message, content }] : [];
            }),
        ];
        const trimmed = await limit(prompt);
        if (trimmed.has(assistant))
          return { prompt: prompt.filter((message) => trimmed.has(message)) };
      }
      return reject();
    },
  } satisfies Processor;

  return {
    processor,
    // Mastra can stop a run on a processor failure without surfacing it in result.error.
    assertFits() {
      if (rejected) throw new LlmError('LLM_REQUEST_REJECTED');
    },
    maxOutputTokens,
    pageCharacters: Math.max(1, Math.min(16000, Math.floor(promptTokens / 3))),
  };
}
