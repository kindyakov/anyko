import type { AgentHistoryPage } from '@anyko/contracts/works';

export function Usage({
  title,
  usage,
}: {
  title: string;
  usage: AgentHistoryPage['runUsage'];
}) {
  return (
    <div className="border-line rounded-xl border p-3">
      <h3 className="font-medium">{title}</h3>
      <p className="text-muted">
        {usage.calls} вызовов · Вход {usage.inputTokens ?? '—'} · Выход{' '}
        {usage.outputTokens ?? '—'}
      </p>
      {(usage.unknownInputCalls > 0 || usage.unknownOutputCalls > 0) && (
        <p className="text-muted">
          Расход неизвестен · Вход {usage.unknownInputCalls} · Выход{' '}
          {usage.unknownOutputCalls}
        </p>
      )}
      {usage.cachedInputTokens !== null && (
        <p className="text-muted">Из кэша {usage.cachedInputTokens}</p>
      )}
      {usage.reasoningTokens !== null && (
        <p className="text-muted">Токены рассуждения {usage.reasoningTokens}</p>
      )}
    </div>
  );
}
