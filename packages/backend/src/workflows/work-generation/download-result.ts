import { checksum, type SourceStorage } from '../../modules/documents';
import type { GenerationModule } from '../../modules/generation';
import { WorkError, type WorksModule } from '../../modules/works';
import type { FileId, GenerationId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { requireCleanSources, requireWork } from '../work-guards';

// Скачивание готового файла: доступ к работе, проверка контрольной суммы перед отдачей.
export const downloadResult =
  (deps: {
    works: WorksModule;
    generation: GenerationModule;
    storage: SourceStorage;
  }) =>
  async (
    scope: WorkspaceScope,
    input: { workId: WorkId; generationId: GenerationId; fileId?: FileId },
  ) => {
    scope.require('works.read');
    await requireWork(deps.works.queries, scope, input.workId);
    await requireCleanSources(deps.works.queries, scope, input.workId);
    const result = await deps.generation.queries.get(
      scope,
      input.workId,
      input.generationId,
    );
    if (!result) throw new WorkError('NOT_FOUND');
    const file = input.fileId
      ? result.files.find((entry) => entry.id === input.fileId)
      : result.files[0];
    if (!file) throw new WorkError('NOT_FOUND');
    if (file.status !== 'succeeded' || !file.key || !file.checksum)
      throw new WorkError('NOT_READY');
    const bytes = await deps.storage.get(file.key);
    if ((await checksum(bytes)) !== file.checksum)
      throw new Error('INVALID_GENERATED_DOCUMENT');
    await requireCleanSources(deps.works.queries, scope, input.workId);
    return {
      bytes,
      filename: `${result.confirmed ? '' : 'draft-'}${file.filename}`,
    };
  };
