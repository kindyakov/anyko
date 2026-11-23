'use client';

import { FileIcon, Link2 } from 'lucide-react';

import type { WorkView } from '@anyko/contracts/works';
import { ActionMenu } from '@anyko/ui';

type Document = WorkView['documents'][number];

/** Привязка файла работы к пункту чек-листа: выбор файла сразу привязывает его. */
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
  return (
    <ActionMenu
      label={`Привязать файл к «${label}»`}
      align="start"
      className="w-full justify-start"
      trigger={
        <>
          <Link2 size={14} aria-hidden />
          Привязать файл
        </>
      }
      items={documents.map((document) => ({
        id: document.id,
        label: document.filename,
        icon: <FileIcon size={14} />,
        disabled: pending,
        onSelect: () => {
          onLink(document);
        },
      }))}
    />
  );
}
