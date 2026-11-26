'use client';

import { Tabs } from '@base-ui/react/tabs';
import { History, MessageSquare } from 'lucide-react';
import { useState } from 'react';

import type { WorkView } from '@anyko/contracts/works';
import { SidePanel } from '@anyko/ui';

import {
  AnalysisJournal,
  type HistoryRun,
  RunHistory,
} from '@/features/work-agent-history';

import { type ChatEntry, ChatTimeline } from './chat-timeline';

export type AgentTab = 'chat' | 'journal';
type Detail = {
  run: HistoryRun;
  kind: ChatEntry['kind'];
  errorCode: string | null;
  from: AgentTab;
};

const tabStyles =
  'text-muted data-[active]:text-ink data-[active]:border-brand-hot focus-visible:outline-brand-hot flex min-h-11 items-center gap-2 border-b-2 border-transparent px-1 text-sm font-medium transition-colors hover:text-ink focus-visible:-outline-offset-2 focus-visible:outline-2';

/**
 * Панель агента рядом с работой: переписка и журнал запусков одной сессии.
 * Подробности запуска открываются внутри панели; вкладки остаются смонтированными,
 * поэтому черновик сообщения и прокрутка чата сохраняются.
 */
export function WorkAgentPanel({
  workspaceId,
  view,
  open,
  tab,
  onOpenChange,
  onTab,
}: {
  workspaceId: string;
  view: WorkView;
  open: boolean;
  tab: AgentTab;
  onOpenChange: (open: boolean) => void;
  onTab: (tab: AgentTab) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Агент"
      closeLabel="Закрыть панель агента"
    >
      {detail && (
        <RunHistory
          key={detail.run.id}
          workspaceId={workspaceId}
          view={view}
          run={detail.run}
          kind={detail.kind}
          errorCode={detail.errorCode}
          backLabel={detail.from === 'chat' ? 'К чату' : 'К журналу'}
          onBack={() => {
            setDetail(null);
          }}
        />
      )}
      <Tabs.Root
        value={tab}
        onValueChange={(value: unknown) => {
          if (value === 'chat' || value === 'journal') onTab(value);
        }}
        hidden={detail !== null}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs.List
          aria-label="Разделы агента"
          className="flex shrink-0 gap-5 border-b border-white/[0.07] px-4"
        >
          <Tabs.Tab value="chat" className={tabStyles}>
            <MessageSquare size={15} aria-hidden />
            Чат
          </Tabs.Tab>
          <Tabs.Tab value="journal" className={tabStyles}>
            <History size={15} aria-hidden />
            Журнал
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel
          value="chat"
          keepMounted
          className="flex min-h-0 flex-1 flex-col data-hidden:hidden"
        >
          <ChatTimeline
            workspaceId={workspaceId}
            view={view}
            onDetails={(entry) => {
              setDetail({
                run: {
                  id: entry.runId,
                  status: entry.status,
                  createdAt: entry.createdAt,
                },
                kind: entry.kind,
                errorCode: entry.kind === 'analysis' ? entry.errorCode : null,
                from: 'chat',
              });
            }}
          />
        </Tabs.Panel>
        <Tabs.Panel
          value="journal"
          className="min-h-0 flex-1 overflow-y-auto p-4"
        >
          <AnalysisJournal
            workspaceId={workspaceId}
            view={view}
            onOpen={(run) => {
              setDetail({
                run,
                kind: 'analysis',
                errorCode: null,
                from: 'journal',
              });
            }}
          />
        </Tabs.Panel>
      </Tabs.Root>
    </SidePanel>
  );
}
