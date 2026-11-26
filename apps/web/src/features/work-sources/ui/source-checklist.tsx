'use client';

import { Collapsible } from '@base-ui/react/collapsible';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleHelp,
} from 'lucide-react';

import { editWorkChecklistLink, type WorkView } from '@anyko/contracts/works';
import { StatusPill } from '@anyko/ui';

import { describeWorkCommandError, invalidateWork } from '@/features/works';
import { callApi } from '@/lib/api/call';
import { useWorkspaceId } from '@/lib/api/workspace';

import { ChecklistContracts } from './checklist-contracts';
import { ChecklistLinkForm } from './checklist-link-form';
import { ChecklistSource } from './checklist-source';
import { statuses } from './checklist-status';

type Document = WorkView['documents'][number];
const groups = [
  { applicability: 'usual', title: 'Обычно нужны' },
  { applicability: 'conditional', title: 'По обстоятельствам' },
] as const;
const statusIcons = {
  confirmed: CheckCircle2,
  found: Check,
  review: CircleHelp,
  missing: Circle,
  clarify: CircleHelp,
};

export function SourceChecklist({
  view,
  onOpen,
}: {
  view: WorkView;
  onOpen: (document: Document, page?: number) => void;
}) {
  const workspaceId = useWorkspaceId();
  const workId = view.work.id;
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      requirementKey,
      document,
      decision,
    }: {
      requirementKey: string;
      document: Document;
      decision: 'confirmed' | 'rejected';
    }) =>
      callApi(editWorkChecklistLink, {
        params: {
          workspaceId,
          workId,
          requirementId: requirementKey,
          documentId: document.id,
        },
        body: { decision, ocrRevision: document.processingRevision ?? null },
      }),
    onSettled: () => invalidateWork(client, workspaceId, workId),
  });
  const byId = new Map(
    view.documents.map((document) => [document.id, document]),
  );

  return (
    <div className="grid min-w-0 gap-3">
      <p
        aria-hidden
        className="text-muted flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px]"
      >
        <span className="inline-flex items-center gap-1">
          <Check size={12} className="text-emerald-300" />
          найдено
        </span>
        <span className="inline-flex items-center gap-1">
          <CircleHelp size={12} className="text-amber-300" />
          проверить
        </span>
        <span className="inline-flex items-center gap-1">
          <Circle size={12} />
          нет
        </span>
      </p>
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-200">
          {describeWorkCommandError(mutation.error)}
        </p>
      )}
      {groups.map(({ applicability, title }) => {
        const items = view.checklist?.filter(
          (item) => item.applicability === applicability,
        );
        if (!items?.length) return null;
        const ready = items.filter(
          ({ status }) => status === 'confirmed' || status === 'found',
        ).length;
        return (
          <div key={applicability}>
            <h3 className="text-muted flex items-center justify-between gap-2 px-1 text-xs font-medium">
              {title}
              <span className="tabular-nums">
                {ready} из {items.length}
              </span>
            </h3>
            <ul
              aria-label={title}
              className="mt-1 divide-y divide-white/[0.06]"
            >
              {items.map((item) => {
                const [label, tone] = statuses[item.status];
                const Status = statusIcons[item.status];
                const remaining = view.documents.filter(
                  (document) =>
                    !item.sources.some(
                      ({ documentId }) => documentId === document.id,
                    ),
                );
                return (
                  <li key={item.key}>
                    <Collapsible.Root>
                      <Collapsible.Trigger
                        className="group focus-visible:outline-brand-hot flex min-h-9 w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm leading-tight hover:bg-white/[0.04] focus-visible:outline-2"
                        title={label}
                      >
                        <Status
                          size={15}
                          aria-hidden
                          className={`shrink-0 ${item.status === 'confirmed' || item.status === 'found' ? 'text-emerald-300' : item.status === 'review' ? 'text-amber-300' : 'text-muted'}`}
                        />
                        <span className="min-w-0 flex-1">{item.label}</span>
                        <span className="sr-only">{label}</span>
                        <ChevronDown
                          size={13}
                          aria-hidden
                          className="text-muted shrink-0 transition-transform group-data-[panel-open]:rotate-180"
                        />
                      </Collapsible.Trigger>
                      <Collapsible.Panel className="grid min-w-0 gap-2 pt-1 pb-3 pl-6">
                        {item.sources.length === 0 && (
                          <div>
                            <StatusPill tone={tone}>{label}</StatusPill>
                          </div>
                        )}
                        <ChecklistContracts
                          item={item}
                          documents={byId}
                          onOpen={onOpen}
                        />
                        {item.sources.length > 0 && (
                          <ul
                            aria-label={`Источники для «${item.label}»`}
                            className="grid gap-2"
                          >
                            {item.sources.map((source) => {
                              const document = byId.get(source.documentId);
                              if (!document) return null;
                              const decide = (
                                decision: 'confirmed' | 'rejected',
                              ) => {
                                mutation.mutate({
                                  requirementKey: item.key,
                                  document,
                                  decision,
                                });
                              };
                              return (
                                <ChecklistSource
                                  key={source.documentId}
                                  itemLabel={item.label}
                                  document={document}
                                  source={source}
                                  canEdit={view.canEditChecklist === true}
                                  pending={mutation.isPending}
                                  onOpen={() => {
                                    onOpen(document, source.page ?? undefined);
                                  }}
                                  onConfirm={() => {
                                    decide('confirmed');
                                  }}
                                  onUnlink={() => {
                                    decide('rejected');
                                  }}
                                />
                              );
                            })}
                          </ul>
                        )}
                        {view.canEditChecklist && remaining.length > 0 && (
                          <ChecklistLinkForm
                            label={item.label}
                            documents={remaining}
                            pending={mutation.isPending}
                            onLink={(document) => {
                              mutation.mutate({
                                requirementKey: item.key,
                                document,
                                decision: 'confirmed',
                              });
                            }}
                          />
                        )}
                      </Collapsible.Panel>
                    </Collapsible.Root>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
