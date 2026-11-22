'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { WorkChatTimeline, WorkView } from '@anyko/contracts/works';
import { Button, Modal, Spinner } from '@anyko/ui';
import { MessageScroller } from '@anyko/ui/chat';

import { HistoryError, RunHistory } from '@/features/work-agent-history';
import { useChatProgress } from '@/features/works';

import { chatMessagesQuery } from '../api/chat';
import { withChatProgress } from '../model/chat-progress';

import { ChatComposer } from './chat-composer';
import { TimelineEntry } from './timeline-entry';

type Props = { workspaceId: string; view: WorkView };
type Entry = WorkChatTimeline['items'][number];

export function WorkChat({ workspaceId, view }: Props) {
  const [open, setOpen] = useState(false);
  if (view.cleanupPending) return null;
  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          setOpen(true);
        }}
      >
        <MessageSquare size={16} aria-hidden />
        Чат с агентом
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Чат с агентом"
        size="sheet"
        scrollBody={false}
      >
        {open && <ChatTimeline workspaceId={workspaceId} view={view} />}
      </Modal>
    </>
  );
}

function ChatTimeline({ workspaceId, view }: Props) {
  const [selection, setSelection] = useState<Entry | null>(null);
  const workId = view.work.id;
  const query = useInfiniteQuery(chatMessagesQuery(workspaceId, workId));
  const progress = useChatProgress(workspaceId, workId);
  const { isFetching, refetch } = query;

  const firstPage = query.data?.pages[0];
  // New entries can move the page boundary between two requests.
  const entries = [
    ...new Map(
      query.data?.pages
        .toReversed()
        .flatMap(({ items }) =>
          items.toReversed().map((entry) => [entry.runId, entry] as const),
        ),
    ).values(),
  ].map((entry) => withChatProgress(entry, progress ?? []));
  const gap = entries.find(({ gap }) => gap)?.gap;
  const requestedGap = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!gap) requestedGap.current = undefined;
    if (!gap || isFetching || requestedGap.current === gap) return;
    requestedGap.current = gap;
    void refetch({ cancelRefetch: false });
  }, [gap, isFetching, refetch]);
  const latest = firstPage?.items[0];
  const busy = latest?.status === 'queued' || latest?.status === 'running';
  const selected =
    entries.find(({ entry }) => entry.runId === selection?.runId)?.entry ??
    selection;

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-white/8">
      <MessageScroller.Provider autoScroll defaultScrollPosition="end">
        <MessageScroller.Root>
          <MessageScroller.Viewport
            aria-label="Переписка с агентом"
            preserveScrollOnPrepend
          >
            {query.hasNextPage && (
              <div className="flex justify-center px-4 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  loading={query.isFetchingNextPage}
                  onClick={() => {
                    void query.fetchNextPage();
                  }}
                >
                  Загрузить ранние сообщения
                </Button>
              </div>
            )}
            <MessageScroller.Content className="px-4 py-5 sm:px-6">
              {query.error && (
                <HistoryError error={query.error} retry={query.refetch} />
              )}
              {query.isPending && (
                <p
                  role="status"
                  className="text-muted m-auto flex items-center gap-2 text-sm"
                >
                  <Spinner className="size-4" />
                  Загружаем чат…
                </p>
              )}
              {firstPage?.total === 0 && (
                <div className="m-auto max-w-72 text-center">
                  <span className="text-brand-hot mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/5">
                    <MessageSquare size={22} aria-hidden />
                  </span>
                  <p className="text-ink font-semibold">
                    Чем помочь с документами?
                  </p>
                  <p className="text-muted mt-2 text-sm leading-6">
                    Спросите про сведения из файлов или попросите изменить поле.
                  </p>
                </div>
              )}
              {entries.map(({ entry }) => (
                <MessageScroller.Item
                  key={entry.runId}
                  messageId={entry.runId}
                  role="article"
                >
                  <TimelineEntry
                    entry={entry}
                    onDetails={() => {
                      setSelection(entry);
                    }}
                  />
                </MessageScroller.Item>
              ))}
            </MessageScroller.Content>
          </MessageScroller.Viewport>
          <MessageScroller.ScrollButton label="К последним сообщениям" />
        </MessageScroller.Root>
      </MessageScroller.Provider>
      <ChatComposer
        workspaceId={workspaceId}
        workId={workId}
        canSend={firstPage?.canSend === true && !busy}
        unavailableText={
          busy
            ? 'Отправка станет доступна, когда агент закончит.'
            : firstPage?.canSend === false
              ? 'Отправка сейчас недоступна.'
              : undefined
        }
      />
      <Modal
        size="sheet"
        open={selected !== null}
        title={
          selected?.kind === 'analysis'
            ? 'Автоматический анализ'
            : 'Действия агента'
        }
        closeLabel="Вернуться к чату"
        onOpenChange={(open) => {
          if (!open) setSelection(null);
        }}
      >
        {selected && (
          <RunHistory
            key={selected.runId}
            workspaceId={workspaceId}
            view={view}
            run={{
              id: selected.runId,
              status: selected.status,
              createdAt: selected.createdAt,
            }}
            presentation="chat"
            errorCode={selected.kind === 'analysis' ? selected.errorCode : null}
          />
        )}
      </Modal>
    </div>
  );
}
