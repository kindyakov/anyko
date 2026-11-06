import type { AgentSession, FieldDefinition } from '@anyko/contracts';

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
    <section className="panel" aria-label="Контекст работы">
      <h2>Контекст работы</h2>
      {!context ? (
        <p>
          После анализа здесь появится сохранённый контекст. Новые документы
          продолжат эту работу.
        </p>
      ) : (
        <>
          <p className="muted">
            Сохранённый контекст · версия {session.revision}
          </p>
          {context.workRevision !== revision && (
            <p role="status">
              Документы или сведения изменились. Контекст будет обновлён при
              следующем анализе.
            </p>
          )}
          <p>{context.summary}</p>
          <p className="muted">
            Сводка агента помогает ориентироваться. Проверяйте сведения по
            исходникам.
          </p>
          {!!context.conflictFields.length && (
            <p>Требуют проверки: {labels(context.conflictFields)}</p>
          )}
          <details>
            <summary>Не заполнены {context.missingFields.length} полей</summary>
            <p>{labels(context.missingFields)}</p>
          </details>
        </>
      )}
    </section>
  );
}
