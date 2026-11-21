import type { ChatProgress, WorkChatTimeline } from '@anyko/contracts/works';

type Entry = WorkChatTimeline['items'][number];

export function withChatProgress(
  entry: Entry,
  deltas: readonly ChatProgress[],
): { entry: Entry; gap?: string } {
  if (entry.kind !== 'chat' || !['queued', 'running'].includes(entry.status))
    return { entry };
  const matching = deltas.filter(({ runId }) => runId === entry.runId);
  const attempt = Math.max(
    entry.attempt ?? 0,
    ...matching.map((delta) => delta.attempt),
  );
  const draft = entry.draft?.attempt === attempt ? entry.draft : undefined;
  let sequence = draft?.sequence ?? 0;
  let answer = draft?.text ?? '';
  let reasoning = draft?.reasoning ?? '';
  let gap: string | undefined;

  for (const delta of matching) {
    if (delta.attempt !== attempt || delta.sequence <= sequence) continue;
    if (delta.sequence > sequence + 1) {
      gap = [entry.runId, attempt, sequence + 1].join(':');
      break;
    }
    sequence = delta.sequence;
    answer += delta.text;
    reasoning += delta.reasoning;
  }
  return { entry: { ...entry, answer, reasoning }, ...(gap && { gap }) };
}
