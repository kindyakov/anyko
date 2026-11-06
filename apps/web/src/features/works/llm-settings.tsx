'use client';
import { type SyntheticEvent, useEffect, useState } from 'react';
import { z } from 'zod';

import { llmSettingsResponseSchema } from '@anyko/contracts';

import { requestApi } from '../../lib/api/client';

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
    <details className="panel">
      <summary>
        Подключение модели{' '}
        {current?.settings ? '· настроено' : '· требуется настройка'}
      </summary>
      {current?.canManage ? (
        <form
          key={current.settings?.revision ?? 0}
          className="settings-form"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <label>
            Адрес OpenAI-совместимого API
            <input
              name="baseURL"
              type="url"
              required
              defaultValue={
                current.settings?.baseURL ?? 'https://routerai.ru/api/v1'
              }
            />
          </label>
          <label>
            Модель для изображений
            <input
              name="visionModel"
              required
              defaultValue={
                current.settings?.visionModel ??
                '~deepseek/deepseek-v4-flash-latest'
              }
            />
          </label>
          <label>
            Модель для извлечения фактов
            <input
              name="extractionModel"
              required
              defaultValue={
                current.settings?.extractionModel ??
                '~deepseek/deepseek-v4-flash-latest'
              }
            />
          </label>
          <label>
            API-ключ{current.settings && ' (пустое поле сохраняет текущий)'}
            <input
              name="apiKey"
              type="password"
              autoComplete="new-password"
              required={!current.settings}
            />
          </label>
          <button disabled={pending}>Сохранить подключение</button>
        </form>
      ) : (
        <p>Настройки подключения меняет владелец рабочей области.</p>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
