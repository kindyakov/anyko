import type { RecognitionService } from '../../src/modules/documents';
import type { LlmSettingsApi } from '../../src/modules/processing';
import { brandDocumentId } from '../../src/platform/ids';

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

export function settingsAs(api: LlmSettingsApi) {
  return {
    current: (workspaceId: string) => api.current(memberScope(workspaceId)),
    save: (workspaceId: string, input: Parameters<LlmSettingsApi['save']>[1]) =>
      api.save(memberScope(workspaceId), input),
  };
}
