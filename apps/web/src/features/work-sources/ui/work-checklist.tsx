'use client';

import { ClipboardList } from 'lucide-react';
import { useState } from 'react';

import type { WorkView } from '@anyko/contracts/works';
import { Button, Modal } from '@anyko/ui';

import { SourceChecklist } from './source-checklist';

export function WorkChecklist({
  view,
  onOpen,
}: {
  view: WorkView;
  onOpen: (document: WorkView['documents'][number], page?: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!view.checklist?.length) return null;

  return (
    <>
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
      <Button
        className="fixed right-4 bottom-20 z-30 shadow-lg xl:hidden"
        variant="secondary"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        <ClipboardList size={16} aria-hidden />
        Чек-лист
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Чек-лист документов"
        size="sheet"
      >
        <SourceChecklist
          view={view}
          onOpen={(document, page) => {
            setOpen(false);
            onOpen(document, page);
          }}
        />
      </Modal>
    </>
  );
}
