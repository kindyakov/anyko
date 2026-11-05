'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState, type SyntheticEvent } from 'react';
import {
  templatesResponseSchema,
  worksResponseSchema,
  workResponseSchema,
  type Template,
  type WorkView,
} from '@anyko/contracts';
import { ApiError, requestApi } from '../../lib/api/client';
import { LlmSettings } from './llm-settings';

export function WorkList({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [works, setWorks] = useState<WorkView['work'][]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [list, catalog] = await Promise.all([
        requestApi('/works', worksResponseSchema),
        requestApi('/templates', templatesResponseSchema),
      ]);
      setWorks(list.works);
      setNextCursor(list.nextCursor);
      setTemplates(catalog.templates);
      setError('');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401)
        onUnauthorized();
      else setError('Не удалось загрузить работы.');
    }
  }, [onUnauthorized]);
  useEffect(() => {
    void load();
  }, [load]);
  async function create(
    event: SyntheticEvent<HTMLFormElement>,
    template: Template,
  ) {
    event.preventDefault();
    setPending(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await requestApi('/works', workResponseSchema, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: data.get('title'),
          templateVersion: template.version,
        }),
      });
      window.location.assign(`/works/${result.work.id}`);
    } catch {
      setPending(false);
      setError('Не удалось создать работу. Попробуйте снова.');
    }
  }
  return (
    <>
      <p className="eyebrow">РАБОЧАЯ ОБЛАСТЬ</p>
      <h1>Ваши документы</h1>
      <p className="intro">
        Выберите шаблон, добавьте исходные файлы и проверьте извлечённые
        сведения.
      </p>
      {error && (
        <div className="error" role="alert">
          {error}{' '}
          <button
            className="secondary"
            onClick={() => {
              void load();
            }}
          >
            Повторить
          </button>
        </div>
      )}
      <section className="panel">
        <h2>Новая работа</h2>
        {templates.map((template) => (
          <form
            className="settings-form"
            key={template.version}
            onSubmit={(event) => {
              void create(event, template);
            }}
          >
            <strong>{template.title}</strong>
            {template.technical && (
              <p className="muted">
                Проверочный бланк для работы конвейера. Окончательный шаблон
                документа ещё не подключён.
              </p>
            )}
            <label>
              Название работы
              <input
                name="title"
                required
                maxLength={200}
                placeholder="Например, документы по объекту"
              />
            </label>
            <button disabled={pending}>Начать работу</button>
          </form>
        ))}
      </section>
      <section className="panel">
        <h2>Все работы</h2>
        {nextCursor && (
          <button
            className="secondary"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void requestApi('/works', worksResponseSchema, {
                query: { after: nextCursor },
              })
                .then((page) => {
                  setWorks((current) => [
                    ...current,
                    ...page.works.filter(
                      (item) => !current.some((row) => row.id === item.id),
                    ),
                  ]);
                  setNextCursor(page.nextCursor);
                })
                .catch(() => {
                  setError('Не удалось загрузить следующую страницу работ.');
                })
                .finally(() => {
                  setPending(false);
                });
            }}
          >
            Показать ещё
          </button>
        )}
        {!works.length && (
          <p className="muted">
            Здесь появятся созданные работы. К каждой можно вернуться позже.
          </p>
        )}
        <ul className="document-list">
          {works.map((work) => (
            <li key={work.id}>
              <div className="document-name">
                <Link href={`/works/${work.id}`}>{work.title}</Link>
                <span className="muted">
                  {work.confirmedRevision === work.revision
                    ? 'Подтверждена'
                    : 'Черновик'}{' '}
                  · {new Date(work.updatedAt).toLocaleString('ru')}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <LlmSettings />
    </>
  );
}
