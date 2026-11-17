'use client';
import { Form } from '@base-ui/react/form';
import { useQuery } from '@tanstack/react-query';
import { Cpu, Save } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Notice, StatusPill } from '@/components/ui/status';
import { useSaveLlmSettings } from '@/features/connections/api/mutations';
import { llmSettingsQueryOptions } from '@/features/connections/api/queries';
import { useWorkspaceId } from '@/lib/api/workspace';

type Message = { tone: 'success' | 'danger'; text: string };

// FormData отдаёт строки для текстовых полей; обязательные поля всегда присутствуют.
function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

export function ConnectionSettings() {
  const workspaceId = useWorkspaceId();
  const query = useQuery(llmSettingsQueryOptions(workspaceId));
  const save = useSaveLlmSettings(workspaceId);
  const [message, setMessage] = useState<Message>();
  const settings = query.data;
  const notice: Message | undefined =
    message ??
    (query.isError
      ? { tone: 'danger', text: 'Не удалось загрузить настройки модели.' }
      : undefined);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setMessage(undefined);
    try {
      const entry = data.get('apiKey');
      const key = typeof entry === 'string' ? entry : '';
      await save.mutateAsync({
        baseURL: text(data, 'baseURL'),
        visionModel: text(data, 'visionModel'),
        extractionModel: text(data, 'extractionModel'),
        ...(key ? { apiKey: key } : {}),
      });
      form.reset();
      setMessage({
        tone: 'success',
        text: 'Настройки сохранены. Новые запуски используют эту версию.',
      });
    } catch {
      setMessage({
        tone: 'danger',
        text: 'Не удалось сохранить настройки. Проверьте адрес, модели и ключ.',
      });
    }
  }
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
      ) : settings?.canManage ? (
        <Form
          key={settings.settings?.revision ?? 0}
          className="grid gap-5"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <FormField label="Адрес API">
            <Input
              name="baseURL"
              type="url"
              required
              defaultValue={
                settings.settings?.baseURL ?? 'https://routerai.ru/api/v1'
              }
            />
          </FormField>
          <FormField
            label="Модель для изображений"
            description="Читает фотографии, сканы и печати"
          >
            <Input
              name="visionModel"
              required
              defaultValue={
                settings.settings?.visionModel ??
                '~deepseek/deepseek-v4-flash-latest'
              }
            />
          </FormField>
          <FormField
            label="Модель для извлечения сведений"
            description="Находит реквизиты и сопоставляет документы"
          >
            <Input
              name="extractionModel"
              required
              defaultValue={
                settings.settings?.extractionModel ??
                '~deepseek/deepseek-v4-flash-latest'
              }
            />
          </FormField>
          <FormField
            label="API-ключ"
            description={
              settings.settings
                ? 'Оставьте пустым, чтобы сохранить текущий ключ'
                : undefined
            }
          >
            <Input
              name="apiKey"
              type="password"
              autoComplete="new-password"
              placeholder={settings.settings ? '••••••••••••' : undefined}
              required={!settings.settings}
            />
          </FormField>
          <Button
            type="submit"
            size="lg"
            loading={save.isPending}
            className="w-fit"
          >
            <Save size={17} />
            Сохранить подключение
          </Button>
        </Form>
      ) : settings ? (
        <Notice tone="neutral">
          Настройки подключения меняет владелец рабочей области.
        </Notice>
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
