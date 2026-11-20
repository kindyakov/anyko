'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Button, Notice } from '@anyko/ui';
import { EventHorizon } from '@anyko/ui/brand';

import type { documentSourceQueryOptions } from '../api/queries';

import type { ScrollSource } from './preview/scroll-sync';

// The renderer can read embedded assets. The preview frame has no scripts or remote resource loads.
const frameSource = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; font-src data: blob:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<style>
html { scrollbar-gutter: stable; overscroll-behavior: contain; }
body { margin: 0; background: #17171b; }
#pages .docx-wrapper { background: transparent; padding: 12px; }
#pages .docx-wrapper > section.docx { margin: 0 0 12px; }
</style>
</head>
<body><main id="pages"></main></body>
</html>`;

function fitPages(container: HTMLElement) {
  const pages = Array.from(
    container.querySelectorAll<HTMLElement>('section.docx'),
  );
  const widest = pages.reduce(
    (width, page) => Math.max(width, page.offsetWidth),
    0,
  );
  if (!widest) return;
  const fit = () => {
    const zoom = Math.min(1, Math.max(1, container.clientWidth - 24) / widest);
    for (const page of pages) page.style.zoom = String(zoom);
  };
  fit();
  const observer = new ResizeObserver(fit);
  observer.observe(container);
  return () => {
    observer.disconnect();
  };
}

export function DocxOriginal({
  filename,
  query,
  onScrollSource,
}: {
  filename: string;
  query: ReturnType<typeof documentSourceQueryOptions>;
  onScrollSource: (source: ScrollSource | null) => void;
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const { data, isError, isFetching, refetch } = useQuery(query);

  useEffect(() => {
    if (!container || !data) return;
    const lifecycle = new AbortController();
    let stopFitting: (() => void) | undefined;
    const doc = container.ownerDocument;
    const content = doc.createElement('div');
    const styles = doc.createElement('div');
    void (async () => {
      const { renderAsync } = await import('docx-preview');
      await renderAsync(await data.arrayBuffer(), content, styles, {
        renderAltChunks: false,
        useBase64URL: true,
      });
      if (lifecycle.signal.aborted) return;
      for (const link of content.querySelectorAll('a')) {
        link.removeAttribute('href');
        link.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
      }
      container.replaceChildren(styles, content);
      stopFitting = fitPages(container);
      setState('ready');
    })().catch(() => {
      if (!lifecycle.signal.aborted) setState('failed');
    });
    return () => {
      lifecycle.abort();
      stopFitting?.();
      container.replaceChildren();
    };
  }, [container, data]);

  useEffect(() => {
    const viewport = container?.ownerDocument.scrollingElement;
    if (!container || !viewport || state !== 'ready' || isError) return;
    onScrollSource({ viewport, content: container });
    return () => {
      onScrollSource(null);
    };
  }, [container, state, isError, onScrollSource]);

  if (state === 'failed' || (isError && !isFetching)) {
    return (
      <div className="grid min-h-full place-items-center p-4">
        <Notice
          tone="warning"
          role="status"
          title="Не удалось показать DOCX"
          action={
            isError && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void refetch();
                }}
              >
                Повторить
              </Button>
            )
          }
        >
          Скачайте оригинал, чтобы открыть его в текстовом редакторе.
        </Notice>
      </div>
    );
  }

  return (
    <div className="relative size-full">
      {state === 'loading' && (
        <div
          role="status"
          className="grid min-h-full place-content-center place-items-center gap-1 p-4"
        >
          <EventHorizon state="active" className="animate-fade size-40" />
          <span className="text-muted text-sm">Открываем DOCX…</span>
        </div>
      )}
      {data && (
        <iframe
          title={`Оригинал: ${filename}`}
          srcDoc={frameSource}
          sandbox="allow-same-origin"
          aria-hidden={state !== 'ready'}
          className={`absolute inset-0 size-full border-0 ${state === 'ready' ? '' : 'invisible'}`}
          onLoad={({ currentTarget }) => {
            const target =
              currentTarget.contentDocument?.getElementById('pages');
            if (target) setContainer(target);
            else setState('failed');
          }}
        />
      )}
    </div>
  );
}
