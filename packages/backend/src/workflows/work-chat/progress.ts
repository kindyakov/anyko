import type {
  ChatDelta,
  ChatProgress,
  ChatProgressFeed,
} from '../../modules/agents';

export function createChatProgressWriter(options: {
  scope: { workspaceId: string; workId: string };
  feed: ChatProgressFeed;
  runId: string;
  attempt: number;
  signal: AbortSignal;
  checkpoint(draft: ChatProgress): Promise<void>;
}) {
  let ticks = 0;
  let saved = 0;
  let batch = { text: '', reasoning: '' };
  const draft: ChatProgress = {
    runId: options.runId,
    attempt: options.attempt,
    sequence: 0,
    text: '',
    reasoning: '',
  };
  let retry: ChatProgress | undefined;
  let pending: Promise<void> | undefined;
  const flush = async () => {
    if (options.signal.aborted) return;
    if (!retry && (batch.text || batch.reasoning)) {
      const chunk = batch;
      batch = { text: '', reasoning: '' };
      draft.sequence++;
      draft.text += chunk.text;
      draft.reasoning += chunk.reasoning;
      retry = { ...draft, ...chunk };
    }
    if (retry) {
      // Keep the payload stable if Redis received the write but its reply was lost.
      const published = await options.feed.append(options.scope, retry).then(
        () => true,
        () => false,
      );
      if (published) retry = undefined;
    }
    if (ticks >= 10 && saved !== draft.sequence) {
      await options.checkpoint({ ...draft });
      saved = draft.sequence;
      ticks = 0;
    }
  };
  const timer = setInterval(() => {
    ticks++;
    if (!pending)
      pending = flush()
        .catch(() => {})
        .finally(() => {
          pending = undefined;
        });
  }, 250);
  timer.unref();
  return {
    push: (delta: ChatDelta) => {
      batch.text += delta.text.slice(
        0,
        Math.max(0, 32000 - draft.text.length - batch.text.length),
      );
      batch.reasoning += delta.reasoning.slice(
        0,
        Math.max(0, 128000 - draft.reasoning.length - batch.reasoning.length),
      );
    },
    async close() {
      clearInterval(timer);
      await pending;
      await flush().catch(() => {});
      if (!retry && (batch.text || batch.reasoning))
        await flush().catch(() => {});
      if (!retry && (batch.text || batch.reasoning))
        await flush().catch(() => {});
    },
  };
}
