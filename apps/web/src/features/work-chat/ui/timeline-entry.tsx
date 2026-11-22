import { ChevronRight, Files, ListTree, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { WorkChatTimeline } from '@anyko/contracts/works';
import {
  Button,
  Notice,
  RelativeTime,
  Spinner,
  StatusPill,
  type Tone,
} from '@anyko/ui';
import { Bubble, BubbleContent, Message, MessageContent } from '@anyko/ui/chat';

import { chatRunErrorText } from '../model/run-error';

type Entry = WorkChatTimeline['items'][number];
const statuses: Record<Entry['status'], { text: string; tone: Tone }> = {
  queued: { text: 'В очереди', tone: 'progress' },
  running: { text: 'Выполняется', tone: 'progress' },
  succeeded: { text: 'Готово', tone: 'success' },
  partial: { text: 'Готово частично', tone: 'warning' },
  failed: { text: 'Ошибка', tone: 'danger' },
  cancelled: { text: 'Отменено', tone: 'neutral' },
};

export function TimelineEntry({
  entry,
  onDetails,
}: {
  entry: Entry;
  onDetails: () => void;
}) {
  const status = statuses[entry.status];
  const failed = entry.status === 'failed' || entry.status === 'partial';

  if (entry.kind === 'analysis') {
    return (
      <div className="border-line border-b">
        <Button
          variant="ghost"
          size="sm"
          aria-haspopup="dialog"
          onClick={onDetails}
          className="w-full justify-start! px-1! py-2 text-left whitespace-normal!"
        >
          <Files size={15} aria-hidden className="shrink-0" />
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-ink">Автоматический анализ</span>
            <StatusPill tone={status.tone}>{status.text}</StatusPill>
          </span>
          <RelativeTime
            value={entry.createdAt}
            className="text-muted hidden text-xs sm:block"
          />
          <ChevronRight size={15} aria-hidden className="shrink-0" />
        </Button>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <Message align="end">
        <MessageContent>
          <Bubble>
            <BubbleContent className="rounded-br-sm whitespace-pre-wrap">
              <span className="sr-only">Вы: </span>
              <span>{entry.userText}</span>
            </BubbleContent>
          </Bubble>
          <RelativeTime
            value={entry.createdAt}
            className="text-muted self-end pr-1 text-xs"
          />
        </MessageContent>
      </Message>
      <Message>
        <span className="text-brand-hot grid size-8 shrink-0 place-items-center rounded-xl border border-rose-300/15 bg-rose-500/10">
          <Sparkles size={17} aria-hidden />
        </span>
        <MessageContent className="pt-1">
          <p className="text-sm font-semibold">Anyko</p>
          {entry.reasoning && (
            <details className="text-muted rounded-lg border border-white/10 px-3 py-2 text-sm">
              <summary className="cursor-pointer">Размышления</summary>
              <div className="mt-2 wrap-anywhere whitespace-pre-wrap">
                {entry.reasoning}
              </div>
            </details>
          )}
          <div aria-live="polite">
            {failed ? (
              <Notice
                tone={entry.status === 'partial' ? 'warning' : 'danger'}
                role="alert"
                title={status.text}
              >
                <p>{chatRunErrorText(entry.errorCode)}</p>
                {entry.status === 'partial' && (
                  <p>
                    Откройте подробности, чтобы проверить сохранённые правки.
                  </p>
                )}
              </Notice>
            ) : entry.answer ? (
              <div className="text-ink space-y-2.5 text-sm leading-6 wrap-anywhere [&_a]:text-rose-300 [&_a]:underline [&_code]:rounded [&_code]:bg-white/8 [&_code]:px-1 [&_li+li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-white/5 [&_pre]:p-3 [&_table]:block [&_table]:overflow-x-auto [&_td]:px-2 [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-5">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  disallowedElements={['img', 'input']}
                  skipHtml
                >
                  {entry.answer}
                </Markdown>
              </div>
            ) : status.tone === 'progress' ? (
              <p className="text-muted flex items-center gap-2 text-sm">
                <Spinner className="text-brand-hot size-3.5" />
                {entry.status === 'queued' ? status.text : 'Готовлю ответ…'}
              </p>
            ) : (
              <p className="text-muted text-sm">{status.text}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={onDetails}
            aria-haspopup="dialog"
            className="-ml-2 self-start"
          >
            <ListTree size={13} aria-hidden />
            Действия агента
            <ChevronRight size={13} aria-hidden />
          </Button>
        </MessageContent>
      </Message>
    </div>
  );
}
