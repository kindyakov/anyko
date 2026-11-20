import {
  obligationFields,
  sameObligation,
} from '@anyko/document-values/obligations';

import type { WorkFacts } from '../../modules/facts';
import type { ChecklistItem } from '../../modules/works';
import { automaticValue } from '../../profiles/bfl/automatic-value';
import type { FieldRow } from '../../profiles/bfl/fields';

type ChecklistWithContracts = ChecklistItem & {
  contracts?: {
    creditor: string;
    contractNumber: string;
    contractDate: string | null;
    status: 'confirmed' | 'found' | 'review' | 'missing';
    documentIds: string[];
  }[];
};

export function checklistWithContracts(
  checklist: ChecklistItem[],
  facts: WorkFacts,
): ChecklistWithContracts[] {
  return checklist.map((item) => {
    if (item.key !== 'debt-certificate') return item;
    const contracts: FieldRow[] = [];
    const add = (row: FieldRow) => {
      if (
        row.name?.trim() &&
        row.contractNumber?.trim() &&
        !contracts.some((known) => sameObligation(known, row))
      )
        contracts.push(row);
    };
    for (const field of obligationFields) {
      const value = facts.values[field];
      if (Array.isArray(value)) value.forEach(add);
    }
    const evidence = facts.candidates.flatMap((candidate) => {
      if (
        candidate.origin === 'inference' ||
        !obligationFields.some((field) => field === candidate.field)
      )
        return [];
      const documents = new Set(
        candidate.evidence.map(({ documentId }) => documentId),
      );
      return [...documents].flatMap((documentId) => {
        const rows = automaticValue({
          ...candidate,
          evidence: candidate.evidence.filter(
            (entry) => entry.documentId === documentId,
          ),
        });
        if (!Array.isArray(rows)) return [];
        rows.forEach(add);
        return rows.map((row) => ({ documentId, row }));
      });
    });
    return {
      ...item,
      contracts: contracts.map((row) => {
        const sources = item.sources.filter(({ documentId }) =>
          evidence.some(
            (entry) =>
              entry.documentId === documentId && sameObligation(entry.row, row),
          ),
        );
        const status =
          (['confirmed', 'found', 'review'] as const).find((decision) =>
            sources.some((source) => source.status === decision),
          ) ?? 'missing';
        return {
          creditor: row.name ?? '',
          contractNumber: row.contractNumber ?? '',
          contractDate: row.contractDate ?? null,
          status,
          documentIds: sources.map(({ documentId }) => documentId),
        };
      }),
    };
  });
}
