import { AlertTriangle, Bot, CircleDashed } from 'lucide-react';

import type { AgentSession, FieldDefinition } from '@anyko/contracts';

import { Disclosure } from '@/components/ui/disclosure';
import { RelativeTime } from '@/components/ui/relative-time';
import { Notice } from '@/components/ui/status';

export function SessionContext({
  session,
  revision,
  fields,
}: {
  session: AgentSession | null;
  revision: number;
  fields: FieldDefinition[];
}) {
  const context = session?.context;
  const saved = context ? session : null;
  const label = (key: string) =>
    fields.find((f) => f.key === key)?.label ?? key;
  return (
    <section
      className="glass relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(120%_140%_at_0%_0%,#2a0a1266,transparent_55%)] p-5 sm:p-6"
      aria-label="Контекст работы"
    >
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#ff3b62]/30 bg-[#db143c]/10 text-[#ff6a88]">
          <Bot size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-bold">Сводка Anyko</h2>
          <p className="text-muted text-xs leading-5">
            {saved ? (
              <>
                Версия {saved.revision} · обновлена{' '}
                <RelativeTime value={saved.updatedAt} />
              </>
            ) : (
              'Что Anyko понял из файлов этой работы'
            )}
          </p>
        </div>
      </div>
      {!context ? (
        <p className="text-muted mt-4 text-sm leading-6">
          После извлечения здесь появится сводка по всем файлам: что удалось
          прочитать, чего не хватает и что требует сверки. Новые файлы продолжат
          эту работу.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          {context.workRevision !== revision && (
            <Notice tone="neutral" role="status">
              Документы или сведения изменились. Контекст будет обновлён при
              следующем извлечении.
            </Notice>
          )}
          <Disclosure
            defaultOpen
            title={<span className="text-muted text-xs">Подробная сводка</span>}
          >
            <p className="max-w-4xl text-sm leading-7 whitespace-pre-line text-zinc-300">
              {context.summary}
            </p>
            <p className="text-muted mt-3 text-xs leading-5">
              Сводка помогает ориентироваться. Проверяйте сведения по исходным
              файлам.
            </p>
          </Disclosure>
          {!!context.conflictFields.length && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-200">
                <AlertTriangle size={14} />
                Требуют проверки
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {context.conflictFields.map((key) => (
                  <li
                    key={key}
                    className="rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-2 py-1 text-xs text-amber-100"
                  >
                    {label(key)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!context.missingFields.length && (
            <Disclosure
              title={
                <span className="flex items-center gap-2 text-xs">
                  <CircleDashed size={14} className="text-zinc-400" />
                  Не заполнены {context.missingFields.length} полей
                </span>
              }
            >
              <ul className="flex flex-wrap gap-1.5">
                {context.missingFields.map((key) => (
                  <li
                    key={key}
                    className="text-muted rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs"
                  >
                    {label(key)}
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </div>
      )}
    </section>
  );
}
