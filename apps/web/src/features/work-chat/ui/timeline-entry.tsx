import { Collapsible } from '@base-ui/react/collapsible';
import { Brain, ChevronRight, ListTree, Sparkles } from 'lucide-react';
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

const answerStyles =
  'text-ink space-y-2.5 text-sm leading-6 wrap-anywhere [&_a]:text-rose-300 [&_a]:underline [&_code]:rounded [&_code]:bg-white/8 [&_code]:px-1 [&_li+li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-white/5 [&_pre]:p-3 [&_strong]:font-semibold [&_table]:block [&_table]:overflow-x-auto [&_td]:border-t [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5';

export function TimelineEntry({
  entry,
  onDetails,
}: {
  entry: Entry;
  onDetails: () => void;
}) {
  const status = statuses[entry.status];
  const failed = entry.status === 'failed' || entry.status === 'partial';

  // Автоматический анализ — системная отметка в ленте, а не реплика.
  if (entry.kind === 'analysis') {
    return (
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-px flex-1 bg-white/[0.08]" />
        <button
          type="button"
          onClick={onDetails}
          className="group text-muted hover:text-ink focus-visible:outline-brand-hot flex max-w-full min-w-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] py-1 pr-2 pl-3 text-xs transition-colors hover:border-white/15 focus-visible:outline-2"
        >
          <span className="truncate">Автоматический анализ</span>
          <StatusPill tone={status.tone} className="px-2 py-0.5">
            {status.text}
          </StatusPill>
          <RelativeTime
            value={entry.createdAt}
            className="hidden text-zinc-500 sm:inline"
          />
          <ChevronRight
            size={13}
            aria-hidden
            className="shrink-0 transition-transform group-hover:translate-x-0.5"
          />
        </button>
        <span aria-hidden className="h-px flex-1 bg-white/[0.08]" />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <Message align="end">
        <MessageContent>
          <Bubble>
            <BubbleContent className="rounded-br-md whitespace-pre-wrap">
              <span className="sr-only">Вы: </span>
              <span>{entry.userText}</span>
            </BubbleContent>
          </Bubble>
          <RelativeTime
            value={entry.createdAt}
            className="self-end pr-1 text-[11px] text-zinc-500"
          />
        </MessageContent>
      </Message>
      <Message>
        <span className="text-brand-hot grid size-7 shrink-0 place-items-center rounded-lg border border-rose-300/15 bg-rose-500/10">
          <Sparkles size={15} aria-hidden />
        </span>
        <MessageContent className="gap-2.5 pt-0.5">
          <p className="text-xs font-semibold text-zinc-300">Anyko</p>
          {entry.reasoning && (
            <Collapsible.Root className="min-w-0">
              <Collapsible.Trigger className="group text-muted hover:text-ink focus-visible:outline-brand-hot inline-flex items-center gap-1.5 rounded-md text-xs transition-colors focus-visible:outline-2">
                <Brain size={13} aria-hidden />
                <span>Размышления</span>
                <ChevronRight
                  size={13}
                  aria-hidden
                  className="transition-transform group-data-[panel-open]:rotate-90"
                />
              </Collapsible.Trigger>
              <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0">
                <div className="text-muted mt-2 border-l border-white/12 pl-3 text-[13px] leading-5 wrap-anywhere whitespace-pre-wrap">
                  {entry.reasoning}
                </div>
              </Collapsible.Panel>
            </Collapsible.Root>
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
                    Откройте действия агента, чтобы проверить сохранённые
                    правки.
                  </p>
                )}
              </Notice>
            ) : entry.answer ? (
              <div className={answerStyles}>
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
