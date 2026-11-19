import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { Ban, Plus } from 'lucide-react';

import type { FieldRow, FieldValue } from '@anyko/contracts/catalog';

export function CollectionNote({
  label,
  collection,
  disabled,
  emptyRow,
  onChange,
}: {
  label: string;
  collection: FieldValue;
  disabled: boolean;
  emptyRow: FieldRow;
  onChange: (value: FieldRow[]) => void;
}) {
  const paperAction =
    'focus-visible:outline-brand-hot inline-flex min-h-6 items-center gap-1 rounded-md px-1.5 font-medium transition-colors hover:bg-rose-100 focus-visible:outline-2';
  return (
    <span className="my-1 inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 rounded-md border border-dashed border-[#db143c]/50 bg-rose-50 px-2 py-0.5 align-middle font-sans text-[12px] leading-5 font-normal text-rose-950">
      <span className="mr-1">
        {label}: {collection === null ? 'состав не установлен' : 'записей нет'}
      </span>
      {!disabled && (
        <>
          <ButtonPrimitive
            className={`${paperAction} text-[#b0102f]`}
            onClick={() => {
              onChange([emptyRow]);
            }}
          >
            <Plus size={12} />
            Добавить запись
          </ButtonPrimitive>
          {collection === null && (
            <ButtonPrimitive
              className={`${paperAction} text-zinc-600`}
              onClick={() => {
                onChange([]);
              }}
            >
              <Ban size={12} />
              Записей нет
            </ButtonPrimitive>
          )}
        </>
      )}
    </span>
  );
}
