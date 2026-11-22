'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleHelp,
  Eye,
  Unlink,
} from 'lucide-react';

import {
  editWorkChecklistLink,
  type WorkChecklistItem,
  type WorkView,
} from '@anyko/contracts/works';
import { Button, StatusPill, type Tone } from '@anyko/ui';

import { describeWorkCommandError, invalidateWork } from '@/features/works';
import { callApi } from '@/lib/api/call';
import { useWorkspaceId } from '@/lib/api/workspace';

import { ChecklistLinkForm } from './checklist-link-form';

type Document = WorkView['documents'][number];
const statuses: Record<WorkChecklistItem['status'], [string, Tone]> = {
  confirmed: ['Подтверждено', 'success'],
  found: ['Найдено', 'success'],
  review: ['На проверке', 'progress'],
  missing: ['Не найдено', 'neutral'],
  clarify: ['Уточнить', 'neutral'],
};
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
        return (
          <div key={applicability}>
            <h3 className="text-muted px-1 text-xs font-medium">{title}</h3>
            <ul
              aria-label={title}
              className="mt-1 divide-y divide-white/[0.06]"
            >
              {items.map((item) => {
                const [label] = statuses[item.status];
                const Status = statusIcons[item.status];
                const remaining = view.documents.filter(
                  (document) =>
                    !item.sources.some(
                      ({ documentId }) => documentId === document.id,
                    ),
                );
                return (
                  <li key={item.key}>
                    <details className="group">
                      <summary
                        className="focus-visible:outline-brand-hot flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md px-1 py-1.5 text-sm leading-tight hover:bg-white/[0.04] focus-visible:outline-2 [&::-webkit-details-marker]:hidden"
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
                          className="text-muted shrink-0 group-open:rotate-180"
                        />
                      </summary>
                      <div className="grid min-w-0 gap-2 pb-2 pl-2">
                        <p className="text-muted text-xs">{label}</p>
                        {!!item.contracts?.length && (
                          <ul
                            aria-label="Справки по договорам"
                            className="grid gap-2"
                          >
                            {item.contracts.map((contract) => (
                              <li
                                key={JSON.stringify([
                                  contract.creditor,
                                  contract.contractNumber,
                                  contract.contractDate,
                                ])}
                                className="flex flex-wrap items-center gap-2 border-l border-white/10 pl-3"
                              >
                                <span className="text-sm wrap-anywhere">
                                  {contract.creditor} · Договор №{' '}
                                  {contract.contractNumber}
                                  {contract.contractDate &&
                                    ` от ${contract.contractDate}`}
                                </span>
                                <StatusPill tone={statuses[contract.status][1]}>
                                  {statuses[contract.status][0]}
                                </StatusPill>
                                {contract.documentIds.map((id) => {
                                  const document = byId.get(id);
                                  const source = item.sources.find(
                                    ({ documentId }) => documentId === id,
                                  );
                                  return (
                                    document && (
                                      <Button
                                        key={id}
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          onOpen(
                                            document,
                                            source?.page ?? undefined,
                                          );
                                        }}
                                      >
                                        <Eye size={15} aria-hidden />
                                        {document.filename}
                                      </Button>
                                    )
                                  );
                                })}
                              </li>
                            ))}
                          </ul>
                        )}
                        {item.sources.length > 0 && (
                          <ul
                            aria-label={`Источники для «${item.label}»`}
                            className="grid gap-2"
                          >
                            {item.sources.map((source) => {
                              const document = byId.get(source.documentId);
                              if (!document) return null;
                              const [sourceLabel, sourceTone] =
                                statuses[source.status];
                              return (
                                <li
                                  key={source.documentId}
                                  className="border-l border-white/10 pl-3"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        onOpen(
                                          document,
                                          source.page ?? undefined,
                                        );
                                      }}
                                    >
                                      <Eye size={15} aria-hidden />
                                      {document.filename}
                                    </Button>
                                    <StatusPill tone={sourceTone}>
                                      {sourceLabel}
                                    </StatusPill>
                                    {source.page && (
                                      <span className="text-muted text-xs">
                                        Стр. {source.page}
                                      </span>
                                    )}
                                    {view.canEditChecklist &&
                                      source.status !== 'confirmed' && (
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          disabled={mutation.isPending}
                                          onClick={() => {
                                            mutation.mutate({
                                              requirementKey: item.key,
                                              document,
                                              decision: 'confirmed',
                                            });
                                          }}
                                        >
                                          Подтвердить
                                        </Button>
                                      )}
                                    {view.canEditChecklist && (
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        disabled={mutation.isPending}
                                        aria-label={`Отвязать «${document.filename}» от «${item.label}»`}
                                        onClick={() => {
                                          mutation.mutate({
                                            requirementKey: item.key,
                                            document,
                                            decision: 'rejected',
                                          });
                                        }}
                                      >
                                        <Unlink size={15} aria-hidden />
                                      </Button>
                                    )}
                                  </div>
                                  {source.quote && (
                                    <p className="text-muted text-xs wrap-anywhere">
                                      {source.quote}
                                    </p>
                                  )}
                                </li>
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
                      </div>
                    </details>
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
