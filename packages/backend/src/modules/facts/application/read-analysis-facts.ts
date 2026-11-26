import type { AnalysisFactsRef, FactsStore } from '..';
import type { FieldDefinition } from '../../../profiles/fields';
import { packageFacts } from '../domain/values';

// Запуск загружен и проверен вызывающим сценарием обработки.
export const readAnalysisFacts =
  (store: Pick<FactsStore, 'get'>) =>
  async (
    { workspaceId, workId }: AnalysisFactsRef,
    fields: readonly FieldDefinition[],
  ) =>
    packageFacts(await store.get(workspaceId, workId), fields);
