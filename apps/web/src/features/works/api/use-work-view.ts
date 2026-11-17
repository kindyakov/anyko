'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { workResponseSchema, type WorkView } from '@anyko/contracts/works';

import { requestApi } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { useExpireSession } from '@/lib/api/query-client';

type WorkLive = 'connecting' | 'live' | 'reconnecting';

// Вид работы загружается и обновляется по событиям сервера. Ответ держит состояние хука,
// а не кэш запросов: события меняют только момент загрузки, данные приходят из API целиком.
// onLoaded вызывается после успешного load(), но не для устаревшего ответа; первый ответ подписки его не вызывает.
export function useWorkView({
  workId,
  onLoaded,
}: {
  workId: string;
  onLoaded: (view: WorkView) => void;
}) {
  const expireSession = useExpireSession();
  const [view, setView] = useState<WorkView>();
  const [loadError, setLoadError] = useState('');
  const [live, setLive] = useState<WorkLive>('connecting');
  const loadVersion = useRef(0);
  const loaded = useRef(onLoaded);
  useEffect(() => {
    loaded.current = onLoaded;
  });
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const result = await requestApi(`/works/${workId}`, workResponseSchema);
      if (version !== loadVersion.current) return;
      setView(result);
      setLoadError('');
      loaded.current(result);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401)
        expireSession();
      else
        setLoadError(
          failure instanceof ApiError && failure.status === 404
            ? 'Работа не найдена.'
            : 'Не удалось обновить работу. Повторите попытку.',
        );
    }
  }, [workId, expireSession]);
  useEffect(() => {
    let active = true;
    let events: EventSource | undefined;
    void requestApi(`/works/${workId}`, workResponseSchema)
      .then((initial) => {
        if (!active) return;
        setView(initial);
        events = new EventSource(
          `/api/works/${workId}/events?after=${initial.cursor}`,
        );
        events.addEventListener('changed', () => {
          void load();
        });
        events.onopen = () => {
          setLive('live');
          void load();
        };
        events.onerror = () => {
          setLive('reconnecting');
          void load();
        };
      })
      .catch(() => {
        if (active) void load();
      });
    return () => {
      active = false;
      loadVersion.current++;
      events?.close();
    };
  }, [workId, load]);
  return { view, loadError, live, load };
}
