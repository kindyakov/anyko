'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Unlink } from 'lucide-react';

import {
  editWorkChecklistLink,
  type WorkChecklistItem,
  type WorkView,
} from '@anyko/contracts/works';
import { Button, StatusPill, type Tone } from '@anyko/ui';

import { describeWorkCommandError, invalidateWork } from '@/features/works';
import { callApi } from '@/lib/api/call';
import { useWorkspaceId } from '@/lib/api/workspace';

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
    <section className="grid gap-4" aria-labelledby="source-checklist-title">
      <h2
        id="source-checklist-title"
        className="font-heading text-xl font-bold tracking-tight"
      >
        Чек-лист исходных документов
      </h2>
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
          <div key={applicability} className="grid gap-2">
            <h3 className="text-muted text-sm font-medium">{title}</h3>
            <ul
              aria-label={title}
              className="glass divide-y divide-white/10 rounded-2xl border border-white/10"
            >
              {items.map((item) => {
                const [label, tone] = statuses[item.status];
                const remaining = view.documents.filter(
                  (document) =>
                    !item.sources.some(
                      ({ documentId }) => documentId === document.id,
                    ),
                );
                return (
                  <li key={item.key} className="grid gap-3 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      <StatusPill tone={tone}>{label}</StatusPill>
                    </div>
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
                                    onOpen(document, source.page ?? undefined);
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
                      <form
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const id = new FormData(event.currentTarget).get(
                            'document',
                          );
                          const document = remaining.find(
                            (entry) => entry.id === id,
                          );
                          if (document)
                            mutation.mutate({
                              requirementKey: item.key,
                              document,
                              decision: 'confirmed',
                            });
                        }}
                      >
                        <select
                          name="document"
                          required
                          defaultValue=""
                          disabled={mutation.isPending}
                          aria-label={`Файл для «${item.label}»`}
                          className="bg-surface max-w-full min-w-0 rounded-lg border border-white/15 px-2 py-1.5 text-sm"
                        >
                          <option value="" disabled>
                            Выбрать файл
                          </option>
                          {remaining.map((document) => (
                            <option key={document.id} value={document.id}>
                              {document.filename}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="submit"
                          size="sm"
                          variant="secondary"
                          disabled={mutation.isPending}
                        >
                          Привязать
                        </Button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
