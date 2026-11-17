import type { FieldValue } from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';
import { Button } from '@anyko/ui';

import type { FactsForm } from '../facts-form';
import { CandidateValue } from '../work-fields';

export function EditConflicts({
  view,
  facts,
  busy,
}: {
  view: WorkView;
  facts: FactsForm;
  busy: boolean;
}) {
  const { values } = facts;
  return facts.conflicts.length > 0 ? (
    <section
      aria-labelledby="conflicts-title"
      className="animate-rise rounded-2xl border border-amber-400/25 bg-amber-400/[0.03] p-4 sm:p-5"
    >
      <h2
        id="conflicts-title"
        className="font-heading text-lg font-bold tracking-tight"
      >
        Изменено и вами, и на сервере
      </h2>
      <p className="text-muted mt-1 text-sm">
        Выберите значение для каждого поля. Пока решения нет, сохранить сведения
        нельзя.
      </p>
      <ul className="mt-4 grid gap-3">
        {facts.conflicts.map((key) => (
          <li
            key={key}
            className="grid gap-3 rounded-xl border border-white/[0.07] bg-black/25 p-3.5 sm:grid-cols-2"
          >
            <h3 className="font-medium sm:col-span-2">
              {view.package.fields.find((field) => field.key === key)?.label ??
                key}
            </h3>
            <div className="min-w-0 text-sm">
              <p className="text-muted mb-1 text-xs">Ваше значение</p>
              <ConflictValue value={values[key]} />
            </div>
            <div className="min-w-0 text-sm">
              <p className="text-muted mb-1 text-xs">На сервере</p>
              <ConflictValue value={facts.serverValues[key]} />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {!Object.hasOwn(facts.serverValues, key) &&
                !view.package.fields.some((field) => field.key === key) && (
                  <p>
                    Поле больше не входит в профиль. Выберите значение сервера,
                    чтобы убрать его из изменений.
                  </p>
                )}
              <Button
                size="sm"
                variant="secondary"
                disabled={
                  busy ||
                  (!Object.hasOwn(facts.serverValues, key) &&
                    !view.package.fields.some((field) => field.key === key))
                }
                onClick={() => {
                  facts.keepMine(key);
                }}
              >
                Оставить моё
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  facts.takeServer(key);
                }}
              >
                Взять с сервера
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  ) : null;
}

// Значение без поля: пустое значение показывается словом, а не пустой строкой.
function ConflictValue({ value }: { value: FieldValue | undefined }) {
  if (value === null || value === undefined)
    return <p className="text-muted text-sm">Пусто</p>;
  return <CandidateValue value={value} />;
}
