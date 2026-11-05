'use client';

import { useCallback, useEffect, useState } from 'react';
import { sessionResponseSchema, type Session } from '@anyko/contracts';
import { ApiError, requestApi } from '../lib/api/client';
import { SignIn, SignOut } from '../features/auth';
import { DocumentWorkspace } from '../features/documents';
import { WorkList, WorkDetail } from '../features/works';

export function Workspace({
  workId,
  documents = false,
}: {
  workId?: string;
  documents?: boolean;
}) {
  const [session, setSession] = useState<Session>();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setChecking(true);
    setError('');
    try {
      const current = await requestApi('/session', sessionResponseSchema);
      setSession(current);
    } catch (failure) {
      setSession(undefined);
      if (!(failure instanceof ApiError && failure.status === 401))
        setError('Не удалось связаться с сервером. Повторите попытку.');
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const unauthorized = useCallback(() => {
    setSession(undefined);
  }, []);
  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Anyko, главная">
          anyko<span>●</span>
        </a>
        {session && (
          <div className="workspace-label">
            <strong>{session.workspace.name}</strong>
            <span>{session.user.name || session.user.email}</span>
            <SignOut onSignedOut={unauthorized} />
          </div>
        )}
      </header>
      <main>
        {session && (
          <nav className="work-actions">
            <a href="/">Работы</a>
            <a href="/documents">Все исходные файлы</a>
          </nav>
        )}
        {checking ? (
          <p className="initial-state" role="status">
            Открываем рабочую область…
          </p>
        ) : error ? (
          <section className="panel">
            <p role="alert">{error}</p>
            <button
              onClick={() => {
                void load();
              }}
            >
              Повторить
            </button>
          </section>
        ) : session ? (
          documents ? (
            <DocumentWorkspace onUnauthorized={unauthorized} />
          ) : workId ? (
            <WorkDetail workId={workId} onUnauthorized={unauthorized} />
          ) : (
            <WorkList onUnauthorized={unauthorized} />
          )
        ) : (
          <SignIn
            onSignedIn={() => {
              void load();
            }}
          />
        )}
      </main>
      <footer>Anyko · Работа с документами</footer>
    </>
  );
}
