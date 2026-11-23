import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import type { FieldValue } from '@anyko/contracts/catalog';
import { Button, StatusPill } from '@anyko/ui';

import { CandidateValue } from '../work-fields';

/**
 * Что сейчас стоит в поле документа. Выглядит как поле формы: пустое —
 * пунктирная рамка с подсказкой, заполненное — значение крупным текстом.
 */
export function CurrentCandidateValue({
  value,
  defaultText,
  changed,
  evidenceLost,
  busy,
  emptyHint,
  onConfirmDefault,
  children,
}: {
  value: FieldValue | undefined;
  defaultText: string | undefined;
  changed: boolean;
  evidenceLost: boolean;
  busy: boolean;
  emptyHint: string;
  onConfirmDefault: (text: string) => void;
  children: ReactNode;
}) {
  const empty = value == null && !defaultText;
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <p className="text-muted text-xs font-medium">В документ подставится</p>
        {defaultText && value == null && (
          <StatusPill tone="neutral">Текст по умолчанию</StatusPill>
        )}
        {changed && (
          <span
            className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200"
            role="status"
          >
            Не сохранено
          </span>
        )}
      </div>
      <div
        className={`rounded-xl border px-3.5 py-3 ${
          empty
            ? 'border-dashed border-white/15 bg-transparent'
            : !evidenceLost && value != null
              ? 'border-emerald-400/20 bg-emerald-400/[0.04]'
              : 'border-white/10 bg-black/20'
        }`}
      >
        <div className="text-ink text-[15px] leading-6 break-words">
          {empty ? (
            <span className="text-muted text-sm">{emptyHint}</span>
          ) : value == null ? (
            defaultText
          ) : Array.isArray(value) && value.length === 0 ? (
            <span>Записей нет</span>
          ) : (
            <CandidateValue value={value} />
          )}
        </div>
        {defaultText && value == null && (
          <Button
            size="sm"
            variant="success"
            className="mt-3"
            disabled={busy}
            onClick={() => {
              onConfirmDefault(defaultText);
            }}
          >
            <Check size={14} aria-hidden />
            Подтвердить текст
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}
