import type { FieldValues, GenerationStore, GenerationTemplate } from '..';
import { brandGenerationId, type WorkId } from '../../../platform/ids';
import type { WorkspaceScope } from '../../../platform/scope/workspace-scope';

// Запись результата с файлами по шаблонам пакета. Внутри транзакции запуска (вызывает сценарий).
export const createGeneration =
  (deps: { store: GenerationStore; newId: () => string }) =>
  async (
    scope: WorkspaceScope,
    input: {
      workId: WorkId;
      revision: number;
      confirmed: boolean;
      values: FieldValues;
      packageVersion: string;
      templates: GenerationTemplate[];
    },
  ) => {
    const id = brandGenerationId(deps.newId());
    await deps.store.create({
      id,
      workspaceId: scope.workspaceId,
      workId: input.workId,
      revision: input.revision,
      confirmed: input.confirmed,
      values: input.values,
      packageVersion: input.packageVersion,
      files: input.templates.map((template) => ({
        id: deps.newId(),
        templateVersion: template.templateVersion,
        title: template.title,
        filename: template.filename,
      })),
    });
    return id;
  };
