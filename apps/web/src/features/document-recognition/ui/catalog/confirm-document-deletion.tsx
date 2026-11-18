import type { DocumentSummary } from '@anyko/contracts/documents';
import { Confirm } from '@anyko/ui';

export function ConfirmDocumentDeletion({
  deleting,
  visible,
  pending,
  onConfirm,
  onCancel,
}: {
  deleting: DocumentSummary[];
  visible: ReadonlySet<string>;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const bulk = deleting.length > 1;
  const acrossPages = deleting.some(({ id }) => !visible.has(id));
  return (
    <Confirm
      open={deleting.length > 0}
      title={
        bulk
          ? `Удалить выбранные файлы (${String(deleting.length)})?`
          : `Удалить «${deleting[0]?.filename ?? ''}»?`
      }
      confirmLabel={bulk ? 'Удалить файлы' : 'Удалить документ'}
      pending={pending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      Оригиналы и результаты распознавания будут удалены без возможности
      восстановления.
      {acrossPages && ' Выбор включает файлы за пределами текущей страницы.'}
    </Confirm>
  );
}
