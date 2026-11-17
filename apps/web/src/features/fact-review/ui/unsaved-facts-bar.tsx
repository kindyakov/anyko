'use client';
import { Save, Undo2 } from 'lucide-react';

import { Button } from '@anyko/ui';

import { conflictSummary } from '../model/facts-messages';

import type { FactsForm } from './facts-form';

// Полоса несохранённых правок: видна, пока форма расходится с сервером. Конфликтные поля блокируют сохранение,
// пока пользователь не выберет значение для каждого из них.
export function UnsavedFactsBar({
  facts,
  busy,
}: {
  facts: FactsForm;
  busy: boolean;
}) {
  if (!facts.hasEdits) return null;
  const conflicted = facts.conflicts.length > 0;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 md:pl-[264px]">
      <div
        role="region"
        aria-label="Несохранённые правки"
        className="animate-rise pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-[#ff3b62]/30 bg-[#141418]/80 p-3 pl-5 shadow-[0_20px_60px_-10px_#000,0_0_40px_-16px_#db143c] backdrop-blur-xl"
      >
        <span className="bg-brand-hot animate-blink size-2 rounded-full shadow-[0_0_8px_#ff3b62]" />
        <div className="min-w-0 flex-1 text-sm">
          <p role="status">Есть несохранённые правки</p>
          {conflicted && (
            <>
              <p className="text-xs text-amber-200">
                {conflictSummary(facts.conflicts.length)}
              </p>
              <p className="text-muted text-xs">
                Сохранение станет доступно после решения по каждому полю.
              </p>
            </>
          )}
          {facts.notice && (
            <p role="alert" className="text-xs text-red-300">
              {facts.notice}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            facts.discard();
          }}
        >
          <Undo2 size={15} />
          Отменить
        </Button>
        <Button
          size="sm"
          loading={facts.saving}
          disabled={busy || conflicted}
          onClick={() => {
            facts.save();
          }}
        >
          <Save size={15} />
          Сохранить
        </Button>
      </div>
    </div>
  );
}
