import type { FieldKey, FieldValues } from '@anyko/contracts/catalog';
import { assessEmployment } from '@anyko/document-values/employment';
import { formatMoneyAmount } from '@anyko/document-values/money';

const rubles = (value: string) =>
  formatMoneyAmount(value, 'RUB_DECIMAL') + ' руб.';

export function EmploymentReview({
  values,
  needsReview,
}: {
  values: FieldValues;
  needsReview?: readonly FieldKey[] | undefined;
}) {
  const employment = assessEmployment(values, undefined, needsReview);
  return (
    <section
      aria-labelledby="employment-title"
      className="glass mb-4 grid gap-2 rounded-2xl border border-white/10 p-4 text-sm"
    >
      <h3 id="employment-title" className="font-heading font-bold">
        Работа и средний доход
      </h3>
      {employment.status === 'review' && (
        <p className="text-muted">
          Статус занятости требует проверки. Сверьте последние кадровые записи.
        </p>
      )}
      {employment.status === 'terminated' && (
        <p>
          Последняя запись — увольнение из {employment.employer} от{' '}
          {employment.date}.
        </p>
      )}
      {employment.status === 'active' && (
        <>
          <p>Действующий работодатель — {employment.employer}.</p>
          {employment.months.length > 0 && (
            <p>
              Учтено месяцев — {employment.months.length}. Период расчёта{' '}
              {employment.months.join(', ')}.
            </p>
          )}
          {employment.sources.length > 0 && (
            <ul
              aria-label="Начисления до вычета налога"
              className="grid gap-1 tabular-nums"
            >
              {employment.sources.map(({ employer, month, code, amount }) => (
                <li key={JSON.stringify([employer, month, code])}>
                  {month} · {employer} · {rubles(amount)}
                  {code && <span className="text-muted"> · код {code}</span>}
                </li>
              ))}
            </ul>
          )}
          {employment.average === null ? (
            <>
              <p className="text-muted">
                Средний доход требует проверки кадровых записей и начислений.
              </p>
              {employment.missing.length > 0 && (
                <p>
                  Нужны начисления за{' '}
                  {employment.missing
                    .map(({ employer, month }) => employer + ' · ' + month)
                    .join(', ')}
                  .
                </p>
              )}
            </>
          ) : (
            <p>
              Начислено {rubles(employment.total)} до вычета налога. Средняя
              зарплата после вычета 13% составляет{' '}
              <strong>{rubles(employment.average)}</strong>
            </p>
          )}
        </>
      )}
    </section>
  );
}
