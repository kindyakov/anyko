import type { AgentHistoryPage } from '@anyko/contracts/works';

type Usage = AgentHistoryPage['runUsage'];

const number = new Intl.NumberFormat('ru-RU');
const amount = (value: number | null) =>
  value === null ? '—' : number.format(value);

/** Расход одного среза — запуска или всей работы — плитками цифр. */
export function UsageStats({ title, usage }: { title: string; usage: Usage }) {
  const unknown = usage.unknownInputCalls + usage.unknownOutputCalls;
  const stats = [
    { label: 'Вызовов', value: number.format(usage.calls) },
    { label: 'Вход', value: amount(usage.inputTokens) },
    { label: 'Выход', value: amount(usage.outputTokens) },
    { label: 'Из кэша', value: amount(usage.cachedInputTokens) },
    { label: 'Рассуждение', value: amount(usage.reasoningTokens) },
  ];
  return (
    <section aria-label={title}>
      <h3 className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(6.25rem,1fr))] gap-1.5">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2"
          >
            <dt className="text-muted truncate text-[11px]">{label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {unknown > 0 && (
        <p className="text-muted mt-2 text-xs">
          Провайдер не сообщил расход: вход — {usage.unknownInputCalls}, выход —{' '}
          {usage.unknownOutputCalls} вызовов.
        </p>
      )}
    </section>
  );
}

/** Расход по этапам запуска таблицей. */
export function StageUsage({
  rows,
}: {
  rows: { key: string; title: string; usage: Usage }[];
}) {
  if (!rows.length) return null;
  return (
    <section aria-label="Расход по этапам">
      <h3 className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">
        По этапам
      </h3>
      <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
        <table className="w-full text-left text-xs tabular-nums">
          <thead className="text-muted bg-white/[0.03]">
            <tr>
              <th className="px-2.5 py-2 font-medium">Этап</th>
              <th className="px-2.5 py-2 text-right font-medium">Вызовов</th>
              <th className="px-2.5 py-2 text-right font-medium">Вход</th>
              <th className="px-2.5 py-2 text-right font-medium">Выход</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, title, usage }) => (
              <tr key={key} className="border-t border-white/[0.05]">
                <td className="max-w-48 px-2.5 py-2 wrap-anywhere">{title}</td>
                <td className="px-2.5 py-2 text-right">
                  {number.format(usage.calls)}
                </td>
                <td className="px-2.5 py-2 text-right">
                  {amount(usage.inputTokens)}
                </td>
                <td className="px-2.5 py-2 text-right">
                  {amount(usage.outputTokens)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
