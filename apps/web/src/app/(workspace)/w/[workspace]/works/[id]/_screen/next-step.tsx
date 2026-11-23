import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileSearch,
  type LucideIcon,
  PackageCheck,
  RotateCw,
  Upload,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Button, Spinner } from '@anyko/ui';

import { errorText, type StepKey, type WorkStage } from '@/features/works';

type Tone = 'brand' | 'progress' | 'danger' | 'warning' | 'success';
type Content = {
  tone: Tone;
  title: string;
  text?: string;
  actions?: ReactNode;
};

const tones: Record<Tone, { box: string; icon: string; Icon: LucideIcon }> = {
  brand: {
    box: 'border-[#ff3b62]/25 bg-[radial-gradient(80%_180%_at_0%_50%,#3a0b1899,transparent_70%)]',
    icon: 'bg-brand/15 text-rose-200 ring-brand/35',
    Icon: ArrowRight,
  },
  progress: {
    box: 'border-sky-400/20 bg-sky-400/[0.05]',
    icon: 'bg-sky-400/10 text-sky-200 ring-sky-400/25',
    Icon: ArrowRight,
  },
  danger: {
    box: 'border-red-400/25 bg-red-500/[0.07]',
    icon: 'bg-red-500/10 text-red-300 ring-red-400/25',
    Icon: AlertTriangle,
  },
  warning: {
    box: 'border-amber-400/25 bg-amber-400/[0.05]',
    icon: 'bg-amber-400/10 text-amber-200 ring-amber-400/25',
    Icon: AlertTriangle,
  },
  success: {
    box: 'border-emerald-400/20 bg-emerald-400/[0.05]',
    icon: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25',
    Icon: Check,
  },
};

/**
 * Полоса следующего действия. Появляется, только когда работа ждёт действия
 * на другом шаге или что-то пошло не так; её кнопка ведёт к этапу работы и не
 * зависит от открытой вкладки.
 */
export function NextStep({
  stage,
  step,
  busy,
  analyzeDisabled,
  generateDisabled,
  onStep,
  onAnalyze,
  onGenerate,
}: {
  stage: WorkStage;
  step: StepKey;
  busy: boolean;
  analyzeDisabled: boolean;
  generateDisabled: boolean;
  onStep: (step: StepKey) => void;
  onAnalyze: () => void;
  onGenerate: () => void;
}) {
  const go = (target: StepKey, label: ReactNode, primary = true) => (
    <Button
      variant={primary ? 'primary' : 'secondary'}
      size="sm"
      onClick={() => {
        onStep(target);
      }}
    >
      {label}
    </Button>
  );
  const content = ((): Content | null => {
    switch (stage.kind) {
      case 'empty':
        return step === 'files'
          ? null
          : {
              tone: 'brand',
              title: 'Добавьте файлы клиента',
              text: 'Паспорт, СНИЛС, справки и выписки — Anyko найдёт в них сведения для документов.',
              actions: go(
                'files',
                <>
                  <Upload size={15} />К файлам
                </>,
              ),
            };
      case 'ready':
        return {
          tone: 'progress',
          title: stage.first
            ? 'Готовим файлы к извлечению'
            : `Новых файлов: ${String(stage.pending)} — сведения будут дополнены`,
          text: 'Извлечение начнётся автоматически, когда файлы распознаются.',
        };
      case 'processing':
        return {
          tone: 'progress',
          title: `Anyko извлекает сведения · этапов ${String(stage.done)} из ${String(stage.total)}`,
          text: 'Можно закрыть страницу — обработка продолжится на сервере.',
          ...(step !== 'extraction' && {
            actions: go('extraction', 'Смотреть процесс', false),
          }),
        };
      case 'failed':
        // На шаге «Извлечение» ошибку и повтор показывает сам шаг.
        return step === 'extraction'
          ? null
          : {
              tone: 'danger',
              title: 'Извлечение не удалось',
              text: stage.run.errorCode
                ? errorText(stage.run.errorCode)
                : 'Обработка завершилась с ошибкой.',
              actions: (
                <>
                  {go('extraction', 'Подробнее', false)}
                  <Button
                    size="sm"
                    loading={busy}
                    disabled={analyzeDisabled}
                    onClick={onAnalyze}
                  >
                    <RotateCw size={15} />
                    Повторить извлечение
                  </Button>
                </>
              ),
            };
      case 'review':
        if (step !== 'review')
          return {
            tone: 'brand',
            title: stage.conflicts
              ? 'Проверьте сведения и разрешите расхождения'
              : 'Сведения ждут проверки',
            text: `Найдено полей: ${String(stage.fields)}${stage.conflicts ? `, расхождений: ${String(stage.conflicts)}` : ''}.`,
            actions: go(
              'review',
              <>
                <FileSearch size={15} />К проверке
              </>,
            ),
          };
        return stage.run.status === 'partial'
          ? {
              tone: 'warning',
              title: 'Часть этапов извлечения не выполнена',
              text: 'Сведения из этих файлов могут отсутствовать — проверьте поля вручную.',
              actions: go('extraction', 'Подробнее', false),
            }
          : null;
      case 'confirmed':
        return step === 'documents'
          ? null
          : {
              tone: 'success',
              title: 'Сведения подтверждены',
              text: 'Осталось сформировать комплект документов в DOCX.',
              actions: (
                <Button
                  size="sm"
                  loading={busy}
                  disabled={generateDisabled}
                  onClick={onGenerate}
                >
                  <PackageCheck size={15} />
                  Сформировать комплект
                </Button>
              ),
            };
      case 'generating':
        return {
          tone: 'progress',
          title: 'Формируем документы',
          text: 'Файлы появятся на шаге «Документы» автоматически.',
        };
      case 'generated':
        return step === 'documents'
          ? null
          : {
              tone: 'success',
              title: `Комплект готов · документов: ${String(stage.files)}`,
              actions: go('documents', 'К документам'),
            };
    }
  })();
  if (!content) return null;
  const { box, icon, Icon } = tones[content.tone];
  return (
    <section
      aria-live="polite"
      aria-label="Следующий шаг"
      className={`animate-rise flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center ${box}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full ring-1 ring-inset ${icon}`}
        >
          {content.tone === 'progress' ? (
            <Spinner className="size-3.5" />
          ) : (
            <Icon size={15} strokeWidth={2.5} aria-hidden />
          )}
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm font-semibold">{content.title}</p>
          {content.text && (
            <p className="text-muted mt-0.5 text-[13px] leading-5">
              {content.text}
            </p>
          )}
        </div>
      </div>
      {content.actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:pl-11">
          {content.actions}
        </div>
      )}
    </section>
  );
}
