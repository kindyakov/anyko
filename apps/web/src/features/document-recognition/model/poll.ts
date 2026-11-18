import type { DocumentSummary } from '@anyko/contracts/documents';

export const recognitionPollMs = 2000;

type RecognitionSnapshot = {
  readonly items: readonly { readonly status: DocumentSummary['status'] }[];
  readonly pendingDeletions: readonly unknown[];
};

// Опрос идёт, пока есть документ в очереди или обработке и пока удаление не завершено; иначе список
// обновляется только по действиям пользователя.
export function recognitionPollInterval(
  snapshot: RecognitionSnapshot | undefined,
): number | false {
  if (!snapshot) return false;
  const busy =
    snapshot.pendingDeletions.length > 0 ||
    snapshot.items.some(
      (document) =>
        document.status === 'queued' || document.status === 'running',
    );
  return busy ? recognitionPollMs : false;
}
