import type { FieldKey, FieldValues } from '@anyko/contracts/catalog';
import { Button } from '@anyko/ui';

import type { courtOptions } from '@/features/fact-review/model/court-options';

export function CourtChoices({
  field,
  choices,
  busy,
  onApply,
}: {
  field: FieldKey;
  choices: ReturnType<typeof courtOptions>;
  busy: boolean;
  onApply: (patch: Partial<FieldValues>) => void;
}) {
  return choices.map((choice) => (
    <Button
      key={JSON.stringify(choice)}
      size="sm"
      variant="secondary"
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
