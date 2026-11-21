'use client';
import { Field } from '@base-ui/react/field';
import { useQuery } from '@tanstack/react-query';
import { Cpu } from 'lucide-react';
import { useState } from 'react';

import { Input, Notice, Skeleton, StatusPill } from '@anyko/ui';

import { llmSettingsQueryOptions } from '@/features/connections/api/queries';
import { useCan, useWorkspaceId } from '@/lib/api/workspace';

import {
  ConnectionForm,
  type ConnectionMessage,
  type LlmSettings,
} from './connection-form';

export function ConnectionSettings() {
  const workspaceId = useWorkspaceId();
  // Право только для отображения: форма без него не показывается, а сохранение проверяет API.
  const canManage = useCan('connections.manage');
  const query = useQuery(llmSettingsQueryOptions(workspaceId));
  const [message, setMessage] = useState<ConnectionMessage>();
  const settings = query.data;
  const notice: ConnectionMessage | undefined = query.isError
    ? { tone: 'danger', text: 'Не удалось загрузить настройки модели.' }
    : message;
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <span className="border-brand/30 bg-brand/10 text-brand-hot grid size-11 shrink-0 place-items-center rounded-xl border">
          <Cpu size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Подключение модели</p>
          <p className="text-muted text-xs leading-5">
            OpenAI-совместимый API для анализа изображений и извлечения сведений
          </p>
        </div>
        {settings ? (
          settings.settings ? (
            <StatusPill tone="success">Подключено</StatusPill>
          ) : (
            <StatusPill tone="warning">Не настроено</StatusPill>
          )
        ) : (
          <Skeleton className="h-6 w-24 rounded-full" />
        )}
      </div>
      {!settings && !notice ? (
        <div className="grid gap-5" aria-hidden>
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="grid gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : settings?.canManage && canManage ? (
        <ConnectionForm
          key={settings.settings?.revision ?? 0}
          current={settings.settings}
          onMessage={setMessage}
        />
      ) : settings ? (
        <>
          <ConnectionReadOnly current={settings.settings} />
          <Notice tone="neutral">
            Изменять подключение может владелец рабочей области.
          </Notice>
        </>
      ) : null}
      {notice && (
        <Notice
          tone={notice.tone}
          role={notice.tone === 'danger' ? 'alert' : 'status'}
        >
          {notice.text}
        </Notice>
      )}
    </div>
  );
}

// Без права изменения значения видны только для чтения; ключ API не выводится вовсе.
function ConnectionReadOnly({ current }: { current: LlmSettings | null }) {
  if (!current) return null;
  return (
    <div className="grid gap-5">
      <ReadOnlyField label="Адрес API" value={current.baseURL} />
      <ReadOnlyField
        label="Модель для изображений"
        value={current.visionModel}
      />
      <ReadOnlyField
        label="Рассуждения при распознавании изображений"
        value={current.visionDisableReasoning ? 'Отключены' : 'По умолчанию'}
      />
      <ReadOnlyField
        label="Модель для извлечения сведений"
        value={current.extractionModel}
      />
      <ReadOnlyField
        label="Рассуждения при извлечении сведений"
        value={
          current.extractionEnableReasoning
            ? 'Высокий уровень'
            : 'Средний уровень'
        }
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Field.Root className="grid gap-2">
      <Field.Label className="text-[13px] font-medium text-zinc-200">
        {label}
      </Field.Label>
      <Input readOnly value={value} />
    </Field.Root>
  );
}
