'use client';
import { Form } from '@base-ui/react/form';
import { Cpu, Save } from 'lucide-react';
import { type SyntheticEvent, useEffect, useState } from 'react';
import { z } from 'zod';

import { llmSettingsResponseSchema } from '@anyko/contracts';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Notice, StatusPill } from '@/components/ui/status';
import { requestApi } from '@/lib/api/client';

export function LlmSettings() {
  const [current, setCurrent] =
    useState<z.infer<typeof llmSettingsResponseSchema>>();
  const [message, setMessage] = useState<{
    tone: 'success' | 'danger';
    text: string;
  }>();
  const [pending, setPending] = useState(false);
  const load = () =>
    requestApi('/settings/llm', llmSettingsResponseSchema).then(setCurrent);
  useEffect(() => {
    void load().catch(() => {
      setMessage({
        tone: 'danger',
        text: 'Не удалось загрузить настройки модели.',
      });
    });
  }, []);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage(undefined);
    try {
      const entry = data.get('apiKey');
      const key = typeof entry === 'string' ? entry : '';
      await requestApi(
        '/settings/llm',
        z.object({ status: z.literal('saved') }),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            baseURL: data.get('baseURL'),
            visionModel: data.get('visionModel'),
            extractionModel: data.get('extractionModel'),
            ...(key ? { apiKey: key } : {}),
          }),
        },
      );
      form.reset();
      await load();
      setMessage({
        tone: 'success',
        text: 'Настройки сохранены. Новые запуски используют эту версию.',
      });
    } catch {
      setMessage({
        tone: 'danger',
        text: 'Не удалось сохранить настройки. Проверьте адрес, модели и ключ.',
      });
    } finally {
      setPending(false);
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
        {current ? (
          current.settings ? (
            <StatusPill tone="success">Подключено</StatusPill>
          ) : (
            <StatusPill tone="warning">Не настроено</StatusPill>
          )
        ) : (
          <Skeleton className="h-6 w-24 rounded-full" />
        )}
      </div>
      {!current && !message ? (
        <div className="grid gap-5" aria-hidden>
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="grid gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : current?.canManage ? (
        <Form
          key={current.settings?.revision ?? 0}
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
                current.settings?.baseURL ?? 'https://routerai.ru/api/v1'
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
                current.settings?.visionModel ??
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
                current.settings?.extractionModel ??
                '~deepseek/deepseek-v4-flash-latest'
              }
            />
          </FormField>
          <FormField
            label="API-ключ"
            description={
              current.settings
                ? 'Оставьте пустым, чтобы сохранить текущий ключ'
                : undefined
            }
          >
            <Input
              name="apiKey"
              type="password"
              autoComplete="new-password"
              placeholder={current.settings ? '••••••••••••' : undefined}
              required={!current.settings}
            />
          </FormField>
          <Button type="submit" size="lg" loading={pending} className="w-fit">
            <Save size={17} />
            Сохранить подключение
          </Button>
        </Form>
      ) : current ? (
        <Notice tone="neutral">
          Настройки подключения меняет владелец рабочей области.
        </Notice>
      ) : null}
      {message && (
        <Notice
          tone={message.tone}
          role={message.tone === 'danger' ? 'alert' : 'status'}
        >
          {message.text}
        </Notice>
      )}
    </div>
  );
}
