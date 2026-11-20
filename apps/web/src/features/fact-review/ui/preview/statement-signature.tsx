import type { FieldValues } from '@anyko/contracts/catalog';

import { signerName } from './paper-format';

export function renderStatementSignature(text: string, values: FieldValues) {
  const signature =
    /^_{3,}\s+(?:\{signerName\}|\{lastName\} \{firstName\} \{middleName\})$/;
  if (!signature.test(text)) return null;
  const name = signerName(values);
  return (
    <span className="inline-flex w-full max-w-[19rem] items-baseline gap-2 text-right indent-0 whitespace-nowrap">
      <span
        aria-hidden
        className="mb-[0.1em] min-w-4 flex-1 self-end border-b border-current"
      />
      <span
        aria-label="Фамилия и инициалы подписанта"
        title={name}
        className="min-w-0 truncate"
      >
        {name}
      </span>
    </span>
  );
}
