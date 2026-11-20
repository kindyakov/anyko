import type { DocumentSummary } from '@anyko/contracts/documents';

import { describeDocumentError } from './error-texts';

export function actionNotice(
  kind: 'retry' | 'delete',
  targets: DocumentSummary[],
  {
    succeeded,
    failed,
  }: { succeeded: string[]; failed: { id: string; error: unknown }[] },
) {
  const names = new Map(targets.map(({ id, filename }) => [id, filename]));
  const count = `${String(succeeded.length)} из ${String(targets.length)}`;
  const title =
    kind === 'retry'
      ? succeeded.length
        ? `Повторное распознавание запущено: ${count}`
        : 'Не удалось повторить распознавание'
      : succeeded.length
        ? `Удалено: ${count}`
        : 'Не удалось удалить файлы';
  const description = failed.length
    ? failed
        .map(
          ({ id, error }) =>
            `${names.get(id) ?? id}: ${describeDocumentError(error)}`,
        )
        .join('\n')
    : targets.map(({ filename }) => filename).join('\n');
  return {
    title,
    description,
    variant: failed.length
      ? succeeded.length
        ? 'warning'
        : 'error'
      : 'success',
    mode: failed.length ? 'persistent' : 'timed',
  } as const;
}
