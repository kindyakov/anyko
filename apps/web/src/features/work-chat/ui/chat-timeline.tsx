'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { WorkChatTimeline, WorkView } from '@anyko/contracts/works';
import { Button, Spinner } from '@anyko/ui';
import { MessageScroller } from '@anyko/ui/chat';

import { HistoryError } from '@/features/work-agent-history';
import { useChatProgress } from '@/features/works';

import { chatMessagesQuery } from '../api/chat';
import { withChatProgress } from '../model/chat-progress';

import { ChatComposer } from './chat-composer';
import { TimelineEntry } from './timeline-entry';

export type ChatEntry = WorkChatTimeline['items'][number];

const suggestions = [
  'Какие поля остались пустыми и почему?',
  'Где сведения в файлах расходятся между собой?',
  'Каких документов не хватает в комплекте?',
];

/** Переписка с агентом и поле ввода. Подробности запуска открывает родитель. */
export function ChatTimeline({
  workspaceId,
  view,
  onDetails,
}: {
  workspaceId: string;
  view: WorkView;
  onDetails: (entry: ChatEntry) => void;
}) {
  const [prefill, setPrefill] = useState<{ text: string; nonce: number }>();
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
                  size="xs"
                  loading={query.isFetchingNextPage}
                  onClick={() => {
                    void query.fetchNextPage();
                  }}
                >
                  Загрузить ранние сообщения
                </Button>
              </div>
            )}
            <MessageScroller.Content className="gap-5 px-4 py-5">
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
                <div className="m-auto w-full max-w-80 text-center">
                  <span className="text-brand-hot mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-rose-300/15 bg-rose-500/10 shadow-[0_0_40px_-12px_#db143c]">
                    <Sparkles size={22} aria-hidden />
                  </span>
                  <p className="text-ink font-semibold">
                    Чем помочь с документами?
                  </p>
                  <p className="text-muted mt-1.5 text-sm leading-6">
                    Спросите про сведения из файлов или попросите изменить поле.
                  </p>
                  <ul
                    aria-label="Примеры вопросов"
                    className="mt-5 grid gap-2 text-left"
                  >
                    {suggestions.map((text) => (
                      <li key={text}>
                        <button
                          type="button"
                          onClick={() => {
                            setPrefill((previous) => ({
                              text,
                              nonce: (previous?.nonce ?? 0) + 1,
                            }));
                          }}
                          className="text-muted hover:text-ink focus-visible:outline-brand-hot w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-[13px] leading-5 transition-colors hover:border-white/15 hover:bg-white/[0.05] focus-visible:outline-2"
                        >
                          {text}
                        </button>
                      </li>
                    ))}
                  </ul>
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
                      onDetails(entry);
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
        key={prefill?.nonce}
        initialText={prefill?.text}
        workspaceId={workspaceId}
        workId={workId}
        canSend={firstPage?.canSend === true && !busy}
        unavailableText={
          busy
            ? 'Агент отвечает — отправка станет доступна, когда он закончит.'
            : firstPage?.canSend === false
              ? 'Отправка сейчас недоступна.'
              : undefined
        }
      />
    </div>
  );
}
