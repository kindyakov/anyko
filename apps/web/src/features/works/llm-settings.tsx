'use client';
import { Form } from '@base-ui/react/form';
import { type SyntheticEvent, useEffect, useState } from 'react';
import { z } from 'zod';

import { llmSettingsResponseSchema } from '@anyko/contracts';

import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { requestApi } from '@/lib/api/client';

export function LlmSettings() {
  const [current, setCurrent] =
    useState<z.infer<typeof llmSettingsResponseSchema>>();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const load = () =>
    requestApi('/settings/llm', llmSettingsResponseSchema).then(setCurrent);
  useEffect(() => {
    void load().catch(() => {
      setMessage('Не удалось загрузить настройки модели.');
    });
  }, []);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage('');
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
      setMessage('Настройки сохранены. Новые запуски используют эту версию.');
    } catch {
      setMessage(
        'Не удалось сохранить настройки. Проверьте адрес, модели и ключ.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Disclosure
      className="border-line my-6 rounded-xl border p-5"
      title={
        <>
          Подключение модели{' '}
          {current?.settings ? '· настроено' : '· требуется настройка'}
        </>
      }
    >
      {current?.canManage ? (
        <Form
          key={current.settings?.revision ?? 0}
          className="mt-6 grid max-w-2xl gap-5"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <FormField
            className="grid gap-2 text-sm font-medium"
            label={<>Адрес OpenAI-совместимого API </>}
          >
            <Input
              className="border-line bg-surface text-ink placeholder:text-muted focus-visible:outline-brand file:bg-tint file:text-ink min-h-11 w-full min-w-0 rounded-lg border px-3 py-2.5 text-sm file:mr-4 file:rounded-md file:border-0 file:px-3 file:py-1 focus-visible:outline-2 disabled:opacity-50"
              name="baseURL"
              type="url"
              required
              defaultValue={
                current.settings?.baseURL ?? 'https://routerai.ru/api/v1'
              }
            />
          </FormField>
          <FormField
            className="grid gap-2 text-sm font-medium"
            label={<>Модель для изображений </>}
          >
            <Input
              className="border-line bg-surface text-ink placeholder:text-muted focus-visible:outline-brand file:bg-tint file:text-ink min-h-11 w-full min-w-0 rounded-lg border px-3 py-2.5 text-sm file:mr-4 file:rounded-md file:border-0 file:px-3 file:py-1 focus-visible:outline-2 disabled:opacity-50"
              name="visionModel"
              required
              defaultValue={
                current.settings?.visionModel ??
                '~deepseek/deepseek-v4-flash-latest'
              }
            />
          </FormField>
          <FormField
            className="grid gap-2 text-sm font-medium"
            label={<>Модель для извлечения фактов </>}
          >
            <Input
              className="border-line bg-surface text-ink placeholder:text-muted focus-visible:outline-brand file:bg-tint file:text-ink min-h-11 w-full min-w-0 rounded-lg border px-3 py-2.5 text-sm file:mr-4 file:rounded-md file:border-0 file:px-3 file:py-1 focus-visible:outline-2 disabled:opacity-50"
              name="extractionModel"
              required
              defaultValue={
                current.settings?.extractionModel ??
                '~deepseek/deepseek-v4-flash-latest'
              }
            />
          </FormField>
          <FormField
            className="grid gap-2 text-sm font-medium"
            label={
              <>
                API-ключ
                {current.settings && ' (пустое поле сохраняет текущий)'}{' '}
              </>
            }
          >
            <Input
              className="border-line bg-surface text-ink placeholder:text-muted focus-visible:outline-brand file:bg-tint file:text-ink min-h-11 w-full min-w-0 rounded-lg border px-3 py-2.5 text-sm file:mr-4 file:rounded-md file:border-0 file:px-3 file:py-1 focus-visible:outline-2 disabled:opacity-50"
              name="apiKey"
              type="password"
              autoComplete="new-password"
              required={!current.settings}
            />
          </FormField>
          <Button type="submit" disabled={pending}>
            Сохранить подключение
          </Button>
        </Form>
      ) : (
        <p>Настройки подключения меняет владелец рабочей области.</p>
      )}
      {message && <p role="status">{message}</p>}
    </Disclosure>
  );
}
