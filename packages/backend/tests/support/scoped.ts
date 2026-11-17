import type { RecognitionService } from '../../src/modules/documents';
import type { LlmSettingsApi } from '../../src/modules/processing';
import type { WorkApi } from '../../src/modules/works';
import {
  brandDocumentId,
  brandFileId,
  brandGenerationId,
  brandWorkId,
} from '../../src/platform/ids';

import { memberScope } from './scope';

// Тестовые клиенты сохраняют прежнюю форму вызова интеграционных проверок: область выдаёт
// модуль access по участию тестового пользователя. Проверяется поведение сценария и данных;
// вызов без области в продакшене не существует.

export function recognitionsAs(service: RecognitionService) {
  return {
    list: (input: { workspaceId: string }) =>
      service.list(memberScope(input.workspaceId)),
    pendingDeletions: (input: { workspaceId: string }) =>
      service.pendingDeletions(memberScope(input.workspaceId)),
    upload: (input: {
      workspaceId: string;
      actorId: string;
      filename: string;
      bytes: Uint8Array;
      requestKey: string;
      correlationId: string;
    }) =>
      service.upload(memberScope(input.workspaceId, input.actorId), {
        filename: input.filename,
        bytes: input.bytes,
        requestKey: input.requestKey,
        correlationId: input.correlationId,
      }),
    get: (input: { workspaceId: string; documentId: string }) =>
      service.get(
        memberScope(input.workspaceId),
        brandDocumentId(input.documentId),
      ),
    result: (input: { workspaceId: string; documentId: string }) =>
      service.result(
        memberScope(input.workspaceId),
        brandDocumentId(input.documentId),
      ),
    source: (input: { workspaceId: string; documentId: string }) =>
      service.source(
        memberScope(input.workspaceId),
        brandDocumentId(input.documentId),
      ),
    image: (input: {
      workspaceId: string;
      documentId: string;
      index: number;
    }) =>
      service.image(
        memberScope(input.workspaceId),
        brandDocumentId(input.documentId),
        input.index,
      ),
    deletion: (input: { workspaceId: string; documentId: string }) =>
      service.deletion(
        memberScope(input.workspaceId),
        brandDocumentId(input.documentId),
      ),
    remove: (input: { workspaceId: string; documentId: string }) =>
      service.remove(
        memberScope(input.workspaceId),
        brandDocumentId(input.documentId),
      ),
    retry: (input: {
      workspaceId: string;
      documentId: string;
      actorId: string;
      correlationId: string;
    }) =>
      service.retry(
        memberScope(input.workspaceId, input.actorId),
        brandDocumentId(input.documentId),
        input.correlationId,
      ),
  };
}

export function workApiAs(api: WorkApi) {
  return {
    packages: () => api.packages(),
    list: (workspaceId: string, after?: string) =>
      api.list(memberScope(workspaceId), after),
    create: (input: {
      workspaceId: string;
      actorId: string;
      title: string;
      packageVersion: string;
    }) =>
      api.create(memberScope(input.workspaceId, input.actorId), {
        title: input.title,
        packageVersion: input.packageVersion,
      }),
    get: (workspaceId: string, workId: string) =>
      api.get(memberScope(workspaceId), brandWorkId(workId)),
    events: (workspaceId: string, workId: string, after: string) =>
      api.events(memberScope(workspaceId), brandWorkId(workId), after),
    upload: (input: {
      workspaceId: string;
      workId: string;
      actorId: string;
      filename: string;
      bytes: Uint8Array;
      correlationId: string;
      requestKey: string;
    }) =>
      api.upload(memberScope(input.workspaceId, input.actorId), {
        workId: brandWorkId(input.workId),
        filename: input.filename,
        bytes: input.bytes,
        correlationId: input.correlationId,
        requestKey: input.requestKey,
      }),
    removeDocument: (input: {
      workspaceId: string;
      workId: string;
      documentId: string;
    }) =>
      api.removeDocument(memberScope(input.workspaceId), {
        workId: brandWorkId(input.workId),
        documentId: brandDocumentId(input.documentId),
      }),
    analyze: (input: {
      workspaceId: string;
      workId: string;
      actorId: string;
      correlationId: string;
    }) =>
      api.analyze(memberScope(input.workspaceId, input.actorId), {
        workId: brandWorkId(input.workId),
        correlationId: input.correlationId,
      }),
    edit: (input: {
      workspaceId: string;
      workId: string;
      revision: number;
      values: Parameters<WorkApi['edit']>[1]['values'];
    }) =>
      api.edit(memberScope(input.workspaceId), {
        workId: brandWorkId(input.workId),
        revision: input.revision,
        values: input.values,
      }),
    confirm: (input: {
      workspaceId: string;
      workId: string;
      revision: number;
    }) =>
      api.confirm(memberScope(input.workspaceId), {
        workId: brandWorkId(input.workId),
        revision: input.revision,
      }),
    generate: (input: {
      workspaceId: string;
      workId: string;
      revision: number;
      actorId: string;
      correlationId: string;
    }) =>
      api.generate(memberScope(input.workspaceId, input.actorId), {
        workId: brandWorkId(input.workId),
        revision: input.revision,
        correlationId: input.correlationId,
      }),
    download: (
      workspaceId: string,
      workId: string,
      generationId: string,
      fileId?: string,
    ) =>
      api.download(
        memberScope(workspaceId),
        brandWorkId(workId),
        brandGenerationId(generationId),
        fileId === undefined ? undefined : brandFileId(fileId),
      ),
  };
}

export function settingsAs(api: LlmSettingsApi) {
  return {
    current: (workspaceId: string) => api.current(memberScope(workspaceId)),
    save: (workspaceId: string, input: Parameters<LlmSettingsApi['save']>[1]) =>
      api.save(memberScope(workspaceId), input),
  };
}
