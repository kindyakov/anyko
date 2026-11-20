import type { AnalysisFactsRef, FactsStore } from '..';

// Запуск загружен и проверен вызывающим сценарием обработки.
export const readAnalysisFacts =
  (store: Pick<FactsStore, 'get'>) =>
  ({ workspaceId, workId }: AnalysisFactsRef) =>
    store.get(workspaceId, workId);
