import { Eye } from 'lucide-react';

import type { WorkChecklistItem, WorkView } from '@anyko/contracts/works';
import { Button, StatusPill } from '@anyko/ui';

import { statuses } from './checklist-status';

type Document = WorkView['documents'][number];

/** Справки по кредитным договорам внутри пункта чек-листа. */
export function ChecklistContracts({
  item,
  documents,
  onOpen,
}: {
  item: WorkChecklistItem;
  documents: Map<string, Document>;
  onOpen: (document: Document, page?: number) => void;
}) {
  if (!item.contracts?.length) return null;
  return (
    <ul aria-label="Справки по договорам" className="grid gap-2">
      {item.contracts.map((contract) => (
        <li
          key={JSON.stringify([
            contract.creditor,
            contract.contractNumber,
            contract.contractDate,
          ])}
          className="grid gap-1.5 border-l border-white/10 pl-3"
        >
          <span className="text-sm wrap-anywhere">
            {contract.creditor} · Договор № {contract.contractNumber}
            {contract.contractDate && ` от ${contract.contractDate}`}
          </span>
          <StatusPill tone={statuses[contract.status][1]}>
            {statuses[contract.status][0]}
          </StatusPill>
          {contract.documentIds.map((id) => {
            const document = documents.get(id);
            const source = item.sources.find(
              ({ documentId }) => documentId === id,
            );
            return (
              document && (
                <Button
                  key={id}
                  variant="ghost"
                  size="sm"
                  className="-ml-2 max-w-full justify-self-start"
                  onClick={() => {
                    onOpen(document, source?.page ?? undefined);
                  }}
                >
                  <Eye size={15} aria-hidden />
                  <span className="min-w-0 truncate">{document.filename}</span>
                </Button>
              )
            );
          })}
        </li>
      ))}
    </ul>
  );
}
