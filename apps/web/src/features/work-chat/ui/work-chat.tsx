'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Send } from 'lucide-react';
import { useState } from 'react';

import type { WorkChatTimeline, WorkView } from '@anyko/contracts/works';
import { Button, Modal, Notice } from '@anyko/ui';

import {
  HistoryError,
  HistoryPagination,
  RunHistory,
} from '@/features/work-agent-history';
import { describeApiError, sharedCodeTexts } from '@/lib/api/errors';
import { createIdempotencyKey } from '@/lib/api/idempotency';

import { chatMessagesQuery, useSendChatMessage } from '../api/chat';

type Entry = WorkChatTimeline['items'][number];
type Props = { workspaceId: string; view: WorkView };

const statuses: Record<Entry['status'], string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  succeeded: 'Готово',
  partial: 'Готово частично',
  failed: 'Ошибка',
  cancelled: 'Отменено',
};

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
        <MessageSquare size={16} />
        Чат с агентом
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Чат с агентом"
        size="sheet"
      >
        {open && <ChatTimeline workspaceId={workspaceId} view={view} />}
      </Modal>
    </>
  );
}

function ChatTimeline({ workspaceId, view }: Props) {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [draftKey, setDraftKey] = useState(createIdempotencyKey);
  const workId = view.work.id;
  const query = useQuery(chatMessagesQuery(workspaceId, workId, page));
  const send = useSendChatMessage(workspaceId, workId);
  const writable = query.data?.canSend === true && !send.isPending;
  return (
    <div className="grid gap-4">
      {query.error && (
        <HistoryError error={query.error} retry={query.refetch} />
      )}
      {query.isPending && <p role="status">Загружаем сообщения…</p>}
      {query.data && (
        <>
          {query.data.total === 0 && (
            <p className="text-muted">
              Здесь появятся сообщения и результаты автоматического анализа.
            </p>
          )}
          <ol className="grid gap-3">
            {query.data.items.toReversed().map((entry) => (
              <TimelineEntry
                key={entry.runId}
                workspaceId={workspaceId}
                view={view}
                entry={entry}
              />
            ))}
          </ol>
          <HistoryPagination
            page={page}
            pages={Math.ceil(query.data.total / query.data.pageSize)}
            onPage={setPage}
          />
        </>
      )}
      {send.error && (
        <Notice tone="danger" role="alert">
          {describeApiError(send.error, {
            codes: {
              FORBIDDEN: sharedCodeTexts.FORBIDDEN,
              WORK_BUSY: 'Агент ещё выполняет текущий запуск.',
              LLM_NOT_CONFIGURED: 'Подключите модель в настройках.',
            },
          })}
        </Notice>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const userText = draft.trim();
          if (!writable || !userText) return;
          send.mutate(
            { userText, key: draftKey },
            {
              onSuccess: () => {
                setDraft('');
                setDraftKey(createIdempotencyKey());
                setPage(1);
              },
            },
          );
        }}
        className="border-line grid gap-2 border-t pt-3"
      >
        <label htmlFor="work-chat-message" className="text-sm font-medium">
          Сообщение агенту
        </label>
        <textarea
          id="work-chat-message"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setDraftKey(createIdempotencyKey());
          }}
          readOnly={!writable}
          maxLength={6000}
          rows={3}
          className="bg-canvas border-line text-ink focus-visible:ring-accent w-full rounded-xl border p-3 text-sm focus-visible:ring-2"
        />
        <Button
          type="submit"
          disabled={!writable || !draft.trim()}
          className="justify-self-end"
        >
          <Send size={16} />
          Отправить
        </Button>
      </form>
    </div>
  );
}

function TimelineEntry({ workspaceId, view, entry }: Props & { entry: Entry }) {
  const [open, setOpen] = useState(false);
  const run = {
    id: entry.runId,
    status: entry.status,
    createdAt: entry.createdAt,
  };
  const isAnalysis = entry.kind === 'analysis';
  return (
    <li
      className={
        isAnalysis ? 'border-line rounded-xl border p-3' : 'grid gap-2'
      }
    >
      {isAnalysis ? (
        <p className="text-sm font-medium">
          Автоматический анализ · {statuses[entry.status]}
        </p>
      ) : (
        <>
          <p className="bg-canvas border-line w-fit max-w-[85%] justify-self-end rounded-2xl border p-3 text-sm wrap-anywhere whitespace-pre-wrap">
            {entry.userText}
          </p>
          {entry.answer ? (
            <p className="text-ink text-sm wrap-anywhere whitespace-pre-wrap">
              {entry.answer}
            </p>
          ) : (
            <p role="status" className="text-muted text-sm">
              {statuses[entry.status]}
            </p>
          )}
        </>
      )}
      <Button
        variant="ghost"
        aria-expanded={open}
        className="mt-1 justify-self-start"
        onClick={() => {
          setOpen(!open);
        }}
      >
        {open ? 'Скрыть подробности' : 'Подробности запуска'}
      </Button>
      {open && (
        <div className="mt-2 grid gap-2">
          {entry.errorCode && (
            <p className="text-muted text-sm">{entry.errorCode}</p>
          )}
          <RunHistory workspaceId={workspaceId} view={view} run={run} />
        </div>
      )}
    </li>
  );
}
