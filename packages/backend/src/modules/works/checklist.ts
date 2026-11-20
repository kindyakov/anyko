export interface ChecklistRequirement {
  key: string;
  documentKind: string;
  label: string;
  applicability: 'usual' | 'conditional';
}

type SourceStatus = 'confirmed' | 'found' | 'review';

export interface ChecklistLink {
  requirementKey: string;
  documentId: string;
  ocrRevision: number | null;
  decision: SourceStatus | 'rejected';
  quote: string | null;
  page: number | null;
}

type ChecklistSource = Pick<ChecklistLink, 'documentId' | 'quote' | 'page'> & {
  status: SourceStatus;
};

export interface ChecklistItem extends ChecklistRequirement {
  status: SourceStatus | 'missing' | 'clarify';
  sources: ChecklistSource[];
}

export function projectChecklist(
  requirements: readonly ChecklistRequirement[],
  links: readonly ChecklistLink[],
  attached: readonly {
    id: string;
    deleted: boolean;
    ocrRevision: number | null;
  }[],
): ChecklistItem[] {
  const active = new Map(
    attached.filter(({ deleted }) => !deleted).map((row) => [row.id, row]),
  );
  const items = new Map<string, ChecklistItem>();
  for (const requirement of requirements) {
    if (items.has(requirement.key)) continue;
    items.set(requirement.key, {
      ...requirement,
      status:
        requirement.applicability === 'conditional' ? 'clarify' : 'missing',
      sources: [],
    });
  }
  for (const link of links) {
    const document = active.get(link.documentId);
    const item = items.get(link.requirementKey);
    if (!document || !item || link.decision === 'rejected') continue;
    const current = document.ocrRevision === link.ocrRevision;
    item.sources.push({
      documentId: link.documentId,
      status: current ? link.decision : 'review',
      page: current ? link.page : null,
      quote: current ? link.quote : null,
    });
  }
  const statusPriority = ['confirmed', 'found', 'review'] as const;
  for (const item of items.values())
    item.status =
      statusPriority.find((status) =>
        item.sources.some((source) => source.status === status),
      ) ?? item.status;
  return [...items.values()];
}
