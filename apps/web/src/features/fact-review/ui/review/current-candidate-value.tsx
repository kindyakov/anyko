import type { ReactNode } from 'react';

import type { FieldValue } from '@anyko/contracts/catalog';
import { Button, StatusPill } from '@anyko/ui';

import { CandidateValue } from '../work-fields';

export function CurrentCandidateValue({
  value,
  defaultText,
  changed,
  evidenceLost,
  busy,
  onConfirmDefault,
  children,
}: {
  value: FieldValue | undefined;
  defaultText: string | undefined;
  changed: boolean;
  evidenceLost: boolean;
  busy: boolean;
  onConfirmDefault: (text: string) => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`mt-3 rounded-xl border px-3.5 py-3 ${value != null && !evidenceLost ? 'border-emerald-400/20 bg-emerald-400/[0.04]' : 'border-white/[0.08] bg-black/20'}`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-xs font-medium text-white/70">
          В документ подставится
        </p>
        {defaultText && <StatusPill tone="neutral">По умолчанию</StatusPill>}
        {changed && (
          <span className="text-xs text-amber-200" role="status">
            Не сохранено
          </span>
        )}
      </div>
      <div className="text-base leading-6 font-semibold break-words">
        {value == null ? (
          <span className="text-white/65">
            {defaultText ?? 'Пока не заполнено'}
          </span>
        ) : Array.isArray(value) && value.length === 0 ? (
          <span>Записей нет</span>
        ) : (
          <CandidateValue value={value} />
        )}
      </div>
      {defaultText && (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            onConfirmDefault(defaultText);
          }}
        >
          Подтвердить текст
        </Button>
      )}
      {children}
    </div>
  );
}
