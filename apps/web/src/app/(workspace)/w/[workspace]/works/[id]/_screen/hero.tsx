import { ArrowRight, Download, FileSearch, PackageCheck } from 'lucide-react';

import { Button } from '@anyko/ui';

import type { StepKey, WorkStage } from '@/features/works';

// Блок «Сейчас»: что происходит с работой и какой следующий шаг предложить.
export function Hero({
  stage,
  step,
  busy,
  generateDisabled,
  onStep,
  onGenerate,
}: {
  stage: WorkStage;
  step: StepKey;
  busy: boolean;
  generateDisabled: boolean;
  onStep: (step: StepKey) => void;
  onGenerate: () => void;
}) {
  const content: {
    title: string;
    text: string;
    action?: React.ReactNode;
  } = (() => {
    switch (stage.kind) {
      case 'empty':
        return {
          title: 'Добавьте файлы клиента',
          text: 'Паспорт, СНИЛС, справки и выписки — Anyko прочитает их и найдёт сведения для документов.',
          ...(step !== 'files' && {
            action: (
              <Button
                onClick={() => {
                  onStep('files');
                }}
              >
                К загрузке файлов <ArrowRight size={16} />
              </Button>
            ),
          }),
        };
      case 'ready':
        return {
          title: 'Подготавливаем файлы к извлечению',
          text: 'Anyko автоматически продолжит после распознавания файлов. Если файл не прочитан, повторите распознавание или уберите его из работы.',
        };
      case 'processing':
        return {
          title: 'Anyko извлекает сведения',
          text: `Выполнено этапов: ${String(stage.done)} из ${String(stage.total)}. Можно закрыть страницу — обработка продолжится на сервере.`,
          ...(step !== 'extraction' && {
            action: (
              <Button
                variant="secondary"
                onClick={() => {
                  onStep('extraction');
                }}
              >
                Смотреть процесс <ArrowRight size={16} />
              </Button>
            ),
          }),
        };
      case 'review':
        return {
          title: stage.conflicts
            ? 'Проверьте сведения и разрешите расхождения'
            : 'Проверьте найденные сведения',
          text: `Найдено полей: ${String(stage.fields)}${stage.conflicts ? `, расхождений: ${String(stage.conflicts)}` : ''}. Сверьте значения с источниками и при необходимости исправьте черновики.${stage.run.status === 'partial' || stage.run.status === 'failed' ? ' Часть этапов извлечения не выполнена.' : ''}`,
          action:
            step === 'review' ? (
              <Button
                onClick={() => {
                  onStep('documents');
                }}
              >
                К шагу «Документы» <ArrowRight size={16} />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  onStep('review');
                }}
              >
                <FileSearch size={16} />
                Перейти к проверке
              </Button>
            ),
        };
      case 'confirmed':
        return {
          title: 'Сведения подтверждены',
          text: 'Осталось сформировать комплект документов в DOCX.',
          action: (
            <Button
              size="lg"
              loading={busy}
              disabled={generateDisabled}
              onClick={onGenerate}
            >
              <PackageCheck size={18} />
              Сформировать комплект
            </Button>
          ),
        };
      case 'generating':
        return {
          title: 'Формируем документы',
          text: 'Anyko заполняет шаблоны. Файлы появятся автоматически.',
        };
      case 'generated':
        return {
          title: 'Комплект готов',
          text: `Сформировано документов: ${String(stage.files)}. Скачайте DOCX или вернитесь к сведениям, чтобы что-то поправить.`,
          ...(step !== 'documents' && {
            action: (
              <Button
                onClick={() => {
                  onStep('documents');
                }}
              >
                <Download size={16} />К документам
              </Button>
            ),
          }),
        };
    }
  })();
  return (
    <section
      aria-live="polite"
      className="glass relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(70%_160%_at_0%_50%,#3a0b18b3,transparent_60%)] p-5 sm:flex-row sm:items-center sm:p-6"
    >
      <div className="min-w-0 flex-1">
        <p className="text-brand-hot text-xs font-semibold tracking-[0.14em] uppercase">
          Сейчас
        </p>
        <p className="font-heading mt-1 text-xl font-bold tracking-tight">
          {content.title}
        </p>
        <p className="text-muted mt-1.5 max-w-2xl text-sm leading-6">
          {content.text}
        </p>
      </div>
      {content.action && <div className="shrink-0">{content.action}</div>}
    </section>
  );
}
