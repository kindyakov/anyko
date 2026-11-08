'use client';
import {
  BadgeCheck,
  Download,
  FileType2,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react';

import type { WorkView } from '@anyko/contracts';

import { EventHorizon } from '@/components/cosmos/event-horizon';
import { Button, buttonStyles } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { RelativeTime } from '@/components/ui/relative-time';
import { Spinner } from '@/components/ui/spinner';
import { stagger } from '@/components/ui/stagger';
import { Notice, StatusPill, type Tone } from '@/components/ui/status';

type Generation = WorkView['generations'][number];
const generationTones: Record<Generation['status'], [string, Tone]> = {
  queued: ['Формируется', 'progress'],
  succeeded: ['Готово', 'success'],
  partial: ['Готово частично', 'warning'],
  failed: ['Ошибка', 'danger'],
};

function Files({
  workId,
  generation,
  large = false,
}: {
  workId: string;
  generation: Generation;
  large?: boolean;
}) {
  return (
    <ul
      className={`grid gap-3 ${large ? 'md:grid-cols-2 xl:grid-cols-3' : ''}`}
    >
      {generation.files.map((file, index) => (
        <li
          key={file.id}
          className={`animate-rise flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[linear-gradient(180deg,#141418,#0d0d10)] p-4 ${stagger(index)}`}
        >
          <span className="relative grid size-12 shrink-0 place-items-center rounded-xl border border-sky-300/20 bg-sky-400/[0.06] text-sky-200">
            <FileType2 size={22} strokeWidth={1.5} />
            <span className="absolute -right-1.5 -bottom-1.5 rounded-md border border-white/10 bg-[#1b1b20] px-1 text-[9px] font-semibold text-zinc-300">
              DOCX
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-5 font-medium">{file.title}</p>
            {file.errorCode ? (
              <p role="status" className="mt-1 text-xs text-red-300">
                Не удалось сформировать. Создайте комплект повторно.
              </p>
            ) : file.status === 'queued' ? (
              <p className="text-muted mt-1 flex items-center gap-1.5 text-xs">
                <Spinner className="size-3" /> Формируется
              </p>
            ) : (
              <p className="text-muted mt-1 truncate text-xs">
                {file.filename}
              </p>
            )}
          </div>
          {file.status === 'succeeded' && (
            <a
              href={`/api/works/${workId}/generations/${generation.id}/files/${file.id}`}
              className={buttonStyles({
                variant: 'secondary',
                size: 'icon-sm',
              })}
              aria-label={`Скачать DOCX: ${file.title}`}
              title="Скачать DOCX"
            >
              <Download size={16} />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export function WorkResults({
  view,
  locked,
  busy,
  hasDraft,
  onConfirm,
  onGenerate,
  onReview,
}: {
  view: WorkView;
  locked: boolean;
  busy: boolean;
  hasDraft: boolean;
  onConfirm: () => void;
  onGenerate: () => void;
  onReview: () => void;
}) {
  const confirmed = view.work.confirmedRevision === view.work.revision;
  const generations = [...view.generations].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const [latest, ...older] = generations;
  const generating = view.runs.some(
    (run) =>
      run.kind === 'generation' &&
      (run.status === 'queued' || run.status === 'running'),
  );
  const fresh = latest?.revision === view.work.revision;
  const blocked = busy || locked || hasDraft;
  return (
    <div className="grid grid-cols-1 gap-8">
      {hasDraft && (
        <Notice tone="warning" role="status" title="Есть несохранённые правки">
          Сохраните или отмените правки полей — документы формируются из
          сохранённой версии.
        </Notice>
      )}
      <ol className="grid gap-4 lg:grid-cols-2">
        <li
          className={`relative overflow-hidden rounded-3xl border p-6 ${confirmed ? 'border-emerald-400/25 bg-emerald-400/[0.04]' : 'border-white/[0.08] bg-[linear-gradient(180deg,#141418,#0c0c0f)]'}`}
        >
          <span className="font-heading text-brand-hot text-xs font-bold">
            01
          </span>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h2 className="font-heading text-xl font-bold">
              Подтвердите сведения
            </h2>
            {confirmed && <StatusPill tone="success">Подтверждено</StatusPill>}
          </div>
          <p className="text-muted mt-2 text-sm leading-6">
            Подтверждение фиксирует текущую версию сведений: документы будут
            сформированы как итоговые, а не черновые.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {confirmed ? (
              <Button variant="secondary" onClick={onReview}>
                Вернуться к сведениям
              </Button>
            ) : (
              <>
                <Button
                  loading={busy && !generating}
                  disabled={blocked || generating}
                  onClick={onConfirm}
                >
                  <ShieldCheck size={17} />
                  Подтвердить сведения
                </Button>
                <Button variant="ghost" onClick={onReview}>
                  Проверить ещё раз
                </Button>
              </>
            )}
          </div>
        </li>
        <li className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[linear-gradient(180deg,#141418,#0c0c0f)] p-6">
          <span className="font-heading text-brand-hot text-xs font-bold">
            02
          </span>
          <h2 className="font-heading mt-2 text-xl font-bold">
            Сформируйте комплект
          </h2>
          <p className="text-muted mt-2 text-sm leading-6">
            {confirmed
              ? 'Anyko заполнит шаблоны подтверждёнными сведениями и соберёт DOCX.'
              : 'Можно сформировать черновик, чтобы посмотреть документы до подтверждения.'}
          </p>
          <div className="mt-5">
            <Button
              variant={confirmed ? 'primary' : 'secondary'}
              loading={generating}
              disabled={blocked}
              onClick={onGenerate}
            >
              <PackageCheck size={17} />
              {confirmed ? 'Сформировать комплект' : 'Сформировать черновик'}
            </Button>
          </div>
        </li>
      </ol>
      <section aria-labelledby="files-title">
        <h2
          id="files-title"
          className="font-heading mb-4 text-xl font-bold tracking-tight"
        >
          Готовые документы
        </h2>
        {!latest ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-12 text-center">
            <EventHorizon
              state={generating ? 'active' : 'calm'}
              className="size-24"
            />
            <p className="mt-6 font-medium">
              {generating ? 'Формируем документы' : 'Документов пока нет'}
            </p>
            <p className="text-muted mt-2 max-w-sm text-sm leading-6">
              {generating
                ? 'Это займёт немного времени — файлы появятся здесь автоматически.'
                : 'Сформированные DOCX появятся здесь для скачивания.'}
            </p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(100%_140%_at_100%_0%,#2a0a1277,transparent_55%),linear-gradient(180deg,#121216,#0b0b0e)] p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <BadgeCheck
                size={22}
                className={
                  latest.confirmed ? 'text-emerald-300' : 'text-zinc-400'
                }
              />
              <p className="font-heading text-lg font-bold">
                {latest.confirmed ? 'Комплект документов' : 'Черновой комплект'}
              </p>
              <StatusPill tone={generationTones[latest.status][1]}>
                {generationTones[latest.status][0]}
              </StatusPill>
              <span className="text-muted text-xs">
                версия сведений {latest.revision} ·{' '}
                <RelativeTime value={latest.createdAt} />
              </span>
            </div>
            {!fresh && (
              <div className="mb-5">
                <Notice tone="neutral">
                  Сведения изменились после формирования. Сформируйте комплект
                  заново, чтобы документы совпадали с текущей версией.
                </Notice>
              </div>
            )}
            <Files workId={view.work.id} generation={latest} large />
          </div>
        )}
        {older.length > 0 && (
          <Disclosure
            className="mt-4 rounded-2xl border border-white/[0.06] px-4"
            title={
              <span className="text-muted text-sm">
                Предыдущие версии · {older.length}
              </span>
            }
          >
            <ul className="grid gap-5">
              {older.map((generation) => (
                <li key={generation.id}>
                  <p className="text-muted mb-2 flex flex-wrap items-center gap-2 text-xs">
                    {generation.confirmed ? 'Документы' : 'Черновик'} · версия{' '}
                    {generation.revision} ·{' '}
                    <RelativeTime value={generation.createdAt} />
                  </p>
                  <Files workId={view.work.id} generation={generation} />
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
      </section>
    </div>
  );
}
