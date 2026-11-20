'use client';

import { useQuery } from '@tanstack/react-query';
import type { PDFDocumentLoadingTask, PDFPageProxy } from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';

import { Notice } from '@anyko/ui';
import { EventHorizon } from '@anyko/ui/brand';

import type { documentSourceQueryOptions } from '../../api/queries';

import type { ScrollSource } from './scroll-sync';

type TextLine = { text: string; top: number };

async function readLines(page: PDFPageProxy): Promise<TextLine[]> {
  const viewport = page.getViewport({ scale: 1 });
  const { items } = await page.getTextContent();
  const lines: TextLine[] = [];
  let line: TextLine | undefined;
  for (const item of items) {
    if (!('str' in item)) continue;
    const baseline = Number(
      viewport.convertToViewportPoint(
        Number(item.transform[4]),
        Number(item.transform[5]),
      )[1],
    );
    const top = Math.max(0, baseline - item.height) / viewport.height;
    if (!Number.isFinite(top)) continue;
    if (line && Math.abs(line.top - top) * viewport.height > 4)
      line = undefined;
    if (!line) {
      line = { text: '', top };
      lines.push(line);
    }
    line.text += item.str;
    if (item.hasEOL) line = undefined;
  }
  return lines.sort((a, b) => a.top - b.top);
}

function PdfPage({ page }: { page: PDFPageProxy }) {
  const sheet = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [lines, setLines] = useState<TextLine[]>([]);
  const [failed, setFailed] = useState(false);
  const { width, height } = page.getViewport({ scale: 1 });

  useEffect(() => {
    let active = true;
    void readLines(page).then(
      (next) => {
        if (active) setLines(next);
      },
      () => {
        // A scan or damaged text layer can still be rendered and scrolled.
      },
    );
    return () => {
      active = false;
    };
  }, [page]);

  useEffect(() => {
    const frame = sheet.current;
    const surface = canvas.current;
    if (!frame || !surface) return;
    let visible = false;
    let rendering: ReturnType<PDFPageProxy['render']> | undefined;
    let lastWidth = 0;
    const draw = () => {
      const pixels = Math.round(
        frame.clientWidth * Math.min(devicePixelRatio, 2),
      );
      if (!visible || !pixels || pixels === lastWidth) return;
      lastWidth = pixels;
      rendering?.cancel();
      const viewport = page.getViewport({ scale: pixels / width });
      surface.width = Math.ceil(viewport.width);
      surface.height = Math.ceil(viewport.height);
      const task = page.render({ canvas: surface, viewport });
      rendering = task;
      void task.promise.catch(() => {
        if (rendering === task) setFailed(true);
      });
    };
    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        if (visible) draw();
        else {
          rendering?.cancel();
          rendering = undefined;
          surface.width = 0;
          surface.height = 0;
          lastWidth = 0;
        }
      },
      { root: frame.closest('section'), rootMargin: '400px 0px' },
    );
    const resize = new ResizeObserver(draw);
    intersection.observe(frame);
    resize.observe(frame);
    return () => {
      intersection.disconnect();
      resize.disconnect();
      rendering?.cancel();
      rendering = undefined;
    };
  }, [page, width]);

  return (
    <div
      ref={sheet}
      data-pdf-page={page.pageNumber}
      className="relative mx-auto w-full max-w-[860px] overflow-hidden rounded-sm bg-white"
      style={{ aspectRatio: width / height }}
    >
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Страница ${String(page.pageNumber)}`}
        className="absolute inset-0 size-full"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span
          data-scroll-anchor={`Страница ${String(page.pageNumber)}`}
          className="absolute top-0"
        />
        {lines.map(({ text, top }, index) => (
          <span
            key={index}
            data-scroll-anchor={text}
            className="absolute"
            style={{ top: `${String(top * 100)}%` }}
          />
        ))}
      </div>
      {failed && (
        <p className="text-muted absolute inset-x-4 top-4 rounded-lg bg-[#1b1b20] p-4 text-sm">
          Не удалось показать страницу. Откройте оригинал в новой вкладке.
        </p>
      )}
    </div>
  );
}

export function PdfOriginal({
  initialPage,
  query,
  onScrollSource,
}: {
  initialPage: number;
  query: ReturnType<typeof documentSourceQueryOptions>;
  onScrollSource: (source: ScrollSource | null) => void;
}) {
  const { data, isError } = useQuery(query);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [failed, setFailed] = useState(false);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data) return;
    const lifecycle = new AbortController();
    let loading: PDFDocumentLoadingTask | undefined;
    void (async () => {
      const [{ getDocument, GlobalWorkerOptions }, bytes] = await Promise.all([
        import('pdfjs-dist'),
        data.arrayBuffer(),
      ]);
      lifecycle.signal.throwIfAborted();
      GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).href;
      loading = getDocument({
        data: bytes,
        cMapUrl: '/pdf-assets/cmaps/',
        standardFontDataUrl: '/pdf-assets/standard_fonts/',
        iccUrl: '/pdf-assets/iccs/',
        wasmUrl: '/pdf-assets/wasm/',
      });
      const pdf = await loading.promise;
      const next = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        lifecycle.signal.throwIfAborted();
        next.push(await pdf.getPage(number));
      }
      lifecycle.signal.throwIfAborted();
      setPages(next);
    })().catch(() => {
      if (!lifecycle.signal.aborted) setFailed(true);
    });
    return () => {
      lifecycle.abort();
      void loading?.destroy().catch(() => undefined);
    };
  }, [data]);

  useEffect(() => {
    const paper = content.current;
    const viewport = paper?.parentElement;
    if (failed || isError || !pages.length || !paper || !viewport) return;
    const start = paper.children[initialPage - 1];
    if (start && initialPage > 1) {
      viewport.scrollTop +=
        start.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top;
    }
    onScrollSource({ viewport, content: paper });
    return () => {
      onScrollSource(null);
    };
  }, [failed, isError, pages, initialPage, onScrollSource]);

  if (failed || isError)
    return (
      <div className="p-4">
        <Notice tone="warning" role="status" title="Не удалось показать PDF">
          Откройте оригинал в новой вкладке.
        </Notice>
      </div>
    );
  if (!pages.length)
    return (
      <div
        role="status"
        className="grid min-h-full place-content-center place-items-center gap-1 p-4"
      >
        <EventHorizon state="active" className="animate-fade size-40" />
        <span className="text-muted text-sm">Открываем PDF…</span>
      </div>
    );
  return (
    <div ref={content} className="space-y-3 p-3">
      {pages.map((page) => (
        <PdfPage key={page.pageNumber} page={page} />
      ))}
    </div>
  );
}
