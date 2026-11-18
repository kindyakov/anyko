import { FileWarning } from 'lucide-react';

import type { documentSourceQueryOptions } from '../api/queries';

import { DocxOriginal } from './docx-original';
import { PdfOriginal } from './preview/pdf-original';
import type { ScrollSource } from './preview/scroll-sync';

export function documentKind(filename: string) {
  const extension = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase();
  if (extension === 'pdf') return 'pdf';
  if (extension === 'docx') return 'docx';
  if (extension && ['jpg', 'jpeg', 'png', 'webp'].includes(extension))
    return 'image';
  return 'other';
}

export function DocumentOriginal({
  filename,
  source,
  page,
  split,
  onScrollSource,
  sourceQuery,
}: {
  filename: string;
  source: string;
  page: number;
  split: boolean;
  onScrollSource: (source: ScrollSource | null) => void;
  sourceQuery: ReturnType<typeof documentSourceQueryOptions>;
}) {
  const kind = documentKind(filename);
  if (kind === 'docx')
    return (
      <DocxOriginal
        filename={filename}
        query={sourceQuery}
        onScrollSource={onScrollSource}
      />
    );
  if (kind === 'image')
    return (
      <div className="grid min-h-full place-items-center p-4">
        <img
          src={source}
          alt={`Оригинал: ${filename}`}
          className="animate-fade max-h-full max-w-full rounded-lg object-contain shadow-[0_20px_60px_-20px_#000]"
        />
      </div>
    );
  if (kind === 'pdf') {
    if (split)
      return (
        <PdfOriginal
          initialPage={page}
          query={sourceQuery}
          onScrollSource={onScrollSource}
        />
      );
    return (
      <iframe
        src={source}
        title={`Оригинал: ${filename}`}
        className="animate-fade block size-full rounded-xl bg-white"
      />
    );
  }
  return (
    <div className="grid min-h-full place-items-center p-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-400">
          <FileWarning size={24} />
        </span>
        <p className="mt-4 font-medium">Браузер не показывает этот формат</p>
        <p className="text-muted mt-2 text-sm leading-6">
          Откройте оригинал в отдельной вкладке или сверяйтесь с распознанным
          текстом.
        </p>
      </div>
    </div>
  );
}
