import type { AgentSession, FieldDefinition } from '@anyko/contracts';

import { Disclosure } from '@/components/ui/disclosure';

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
  const labels = (keys: string[]) =>
    keys
      .map((key) => fields.find((f) => f.key === key)?.label ?? key)
      .join(', ');
  return (
    <section
      className="border-line my-6 rounded-xl border p-5"
      aria-label="Контекст работы"
    >
      <h2 className="font-heading mb-4 text-lg font-bold">Контекст работы</h2>
      {!context ? (
        <p>
          После анализа здесь появится сохранённый контекст. Новые документы
          продолжат эту работу.
        </p>
      ) : (
        <>
          <p className="text-muted text-sm leading-6">
            Сохранённый контекст · версия {session.revision}
          </p>
          {context.workRevision !== revision && (
            <p role="status">
              Документы или сведения изменились. Контекст будет обновлён при
              следующем анализе.
            </p>
          )}
          <p>{context.summary}</p>
          <p className="text-muted text-sm leading-6">
            Сводка агента помогает ориентироваться. Проверяйте сведения по
            исходникам.
          </p>
          {!!context.conflictFields.length && (
            <p>Требуют проверки: {labels(context.conflictFields)}</p>
          )}
          <Disclosure
            title={<>Не заполнены {context.missingFields.length} полей</>}
          >
            <p>{labels(context.missingFields)}</p>
          </Disclosure>
        </>
      )}
    </section>
  );
}
