'use client';

import { ClipboardList } from 'lucide-react';

import type { WorkView } from '@anyko/contracts/works';
import { Modal } from '@anyko/ui';

import { SourceChecklist } from './source-checklist';

export function WorkChecklist({
  view,
  docked,
  open,
  onOpenChange,
  onOpen,
}: {
  view: WorkView;
  /** Колонка справа на широком экране; иначе — только окно по кнопке в шапке. */
  docked: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: (document: WorkView['documents'][number], page?: number) => void;
}) {
  if (!view.checklist?.length) return null;

  return (
    <>
      {docked && (
        <aside
          aria-labelledby="work-checklist-title"
          className="glass sticky top-5 hidden max-h-[calc(100dvh-2.5rem)] overflow-y-auto rounded-2xl border border-white/10 p-3 xl:block"
        >
          <h2
            id="work-checklist-title"
            className="font-heading mb-3 flex items-center gap-2 px-1 text-base font-bold"
          >
            <ClipboardList
              size={17}
              className="text-brand-hot shrink-0"
              aria-hidden
            />
            Чек-лист документов
          </h2>
          <SourceChecklist view={view} onOpen={onOpen} />
        </aside>
      )}
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Чек-лист документов"
        size="sheet"
      >
        <SourceChecklist
          view={view}
          onOpen={(document, page) => {
            onOpenChange(false);
            onOpen(document, page);
          }}
        />
      </Modal>
    </>
  );
}
