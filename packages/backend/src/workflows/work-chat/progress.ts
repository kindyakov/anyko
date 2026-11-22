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
  const outgoing: ChatProgress[] = [];
  let publishing: Promise<void> | undefined;
  let checkpointPending: Promise<void> | undefined;
  let closed = false;
  const flush = () => {
    if (options.signal.aborted) return;
    if (batch.text || batch.reasoning) {
      const chunk = batch;
      batch = { text: '', reasoning: '' };
      draft.sequence++;
      draft.text += chunk.text;
      draft.reasoning += chunk.reasoning;
      outgoing.push({ ...draft, ...chunk });
    }
    if (!publishing && outgoing.length)
      publishing = (async () => {
        for (
          let delta = outgoing[0];
          delta && !closed && !options.signal.aborted;
          delta = outgoing[0]
        ) {
          // A lost acknowledgement must retry the same sequence and payload.
          await options.feed.append(options.scope, delta);
          outgoing.shift();
        }
      })()
        .catch(() => {})
        .finally(() => {
          publishing = undefined;
        });
    if (!checkpointPending && ticks >= 10 && saved !== draft.sequence) {
      const snapshot = { ...draft };
      ticks = 0;
      // A PostgreSQL lock may delay the snapshot. Redis deltas continue independently.
      checkpointPending = Promise.resolve()
        .then(() => options.checkpoint(snapshot))
        .then(
          () => {
            saved = snapshot.sequence;
          },
          () => {},
        )
        .finally(() => {
          checkpointPending = undefined;
        });
    }
  };
  const timer = setInterval(() => {
    ticks++;
    flush();
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
      flush();
      if (publishing) await Promise.race([publishing, Bun.sleep(2000)]);
      closed = true;
      await checkpointPending;
    },
  };
}
