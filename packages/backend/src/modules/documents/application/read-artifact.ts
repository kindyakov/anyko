import { DocumentError } from '../errors';
import type { InternalResultRef } from '../index';

import type { DocumentDeps } from './ports';
import { documentResultSchema } from './result-schema';

// Общий разбор результата распознавания: читается только проверенный JSON ограниченного размера.
// Помощник не выполняет право: его вызывают команды-запросы, которые уже проверили доступ.
export const readArtifact =
  (deps: Pick<DocumentDeps, 'store' | 'storage'>) =>
  async (input: InternalResultRef) => {
    const found = await deps.store.get(input.workspaceId, input.documentId);
    if (!found) throw new DocumentError('NOT_FOUND');
    const ready = await deps.store.readyResult(
      input.workspaceId,
      input.documentId,
      input.revision,
    );
    if (!ready) throw new DocumentError('NOT_READY');
    const bytes = await deps.storage.get(ready.resultKey);
    if (bytes.length > 5 * 1024 * 1024) throw new Error('INVALID_ARTIFACT');
    const result = documentResultSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)) as unknown,
    );
    return { result, revision: ready.revision };
  };
