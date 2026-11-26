import type { FieldKey, FieldValues } from '@anyko/contracts/catalog';
import { Button } from '@anyko/ui';

import type { courtOptions } from '@/features/fact-review/model/court-options';

export function CourtChoices({
  field,
  choices,
  busy,
  primary = false,
  onApply,
}: {
  field: FieldKey;
  choices: ReturnType<typeof courtOptions>;
  busy: boolean;
  /** Поле пустое: подстановка — главное действие карточки. */
  primary?: boolean;
  onApply: (patch: Partial<FieldValues>) => void;
}) {
  return choices.map((choice) => (
    <Button
      key={JSON.stringify(choice)}
      size="sm"
      variant={primary ? 'primary' : 'secondary'}
      disabled={busy}
      onClick={(event) => {
        event.currentTarget
          .closest('article')
          ?.querySelector('h3')
          ?.focus({ preventScroll: true });
        onApply(choice);
      }}
    >
      {choices.length > 1
        ? `Выбрать ${field === 'courtAddress' ? choice.courtName : (choice.courtAddress ?? choice.courtName)}`
        : choice.courtAddress
          ? 'Подставить суд и адрес'
          : 'Подставить суд'}
    </Button>
  ));
}
