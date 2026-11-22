'use client';

import { useState } from 'react';

import type { WorkView } from '@anyko/contracts/works';
import { Button, Select } from '@anyko/ui';

type Document = WorkView['documents'][number];

export function ChecklistLinkForm({
  label,
  documents,
  pending,
  onLink,
}: {
  label: string;
  documents: Document[];
  pending: boolean;
  onLink: (document: Document) => void;
}) {
  const [id, setId] = useState('');
  const selected = documents.find((document) => document.id === id);

  return (
    <form
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (selected) onLink(selected);
      }}
    >
      <Select
        disabled={pending}
        label={`Файл для «${label}»`}
        placeholder="Выбрать файл"
        items={documents.map(({ id, filename }) => ({
          value: id,
          label: filename,
        }))}
        value={selected?.id ?? ''}
        onValueChange={setId}
      />
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        disabled={pending || !selected}
      >
        Привязать
      </Button>
    </form>
  );
}
