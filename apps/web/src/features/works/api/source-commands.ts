import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { type Dispatch, type SetStateAction } from 'react';

import {
  editWorkDocumentRecognition,
  removeWorkDocument,
  uploadWorkDocument,
} from '@anyko/contracts/works';

import {
  invalidateDocumentCatalog,
  useRetryDocument,
} from '@/features/document-recognition';
import { callApi, newIdempotencyKey } from '@/lib/api/call';
import { isUnauthorized } from '@/lib/api/errors';

import { uploadFailureMessage } from '../model/upload-errors';

import { invalidateWork } from './mutations';

export interface Upload {
  id: string;
  name: string;
  state: 'uploading' | 'done' | 'failed';
  reason?: string;
}

// Загрузка файла в работу: ключ создаёт вызывающий на каждый файл при выборе.
export function useUploadWorkDocument(workspaceId: string, workId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      idempotencyKey,
    }: {
      file: File;
      idempotencyKey: string;
    }) =>
      callApi(uploadWorkDocument, {
        params: { workspaceId, workId },
        body: { file },
        idempotencyKey,
        timeoutMs: 60000,
      }),
    onSuccess: () =>
      Promise.all([
        invalidateWork(client, workspaceId, workId),
        invalidateDocumentCatalog(client, workspaceId),
      ]),
    onError: () => invalidateWork(client, workspaceId, workId),
  });
}

export function useDeleteWorkDocument(workspaceId: string, workId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      callApi(removeWorkDocument, {
        params: { workspaceId, workId, documentId },
      }),
    onSuccess: () =>
      Promise.all([
        invalidateWork(client, workspaceId, workId),
        invalidateDocumentCatalog(client, workspaceId),
      ]),
  });
}

export function useUpdateWorkDocumentRecognition(
  workspaceId: string,
  workId: string,
) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: recognitionRevisionKey(workspaceId, workId),
    mutationFn: ({
      documentId,
      ocrRevision,
    }: {
      documentId: string;
      ocrRevision: number;
    }) =>
      callApi(editWorkDocumentRecognition, {
        params: { workspaceId, workId, documentId },
        body: { ocrRevision },
      }),
    onSettled: () => invalidateWork(client, workspaceId, workId),
  });
}

function recognitionRevisionKey(workspaceId: string, workId: string) {
  return ['works', workspaceId, workId, 'update-recognition'] as const;
}

export function useUpdatingWorkRecognition(
  workspaceId: string,
  workId: string,
) {
  return (
    useIsMutating({
      mutationKey: recognitionRevisionKey(workspaceId, workId),
      exact: true,
    }) > 0
  );
}

export function useRetryWorkDocument(workspaceId: string, workId: string) {
  const client = useQueryClient();
  return useRetryDocument(workspaceId, () =>
    invalidateWork(client, workspaceId, workId),
  );
}

// Загружает файлы по одному и на каждый создаёт свой ключ. Ошибка одного файла отмечается в списке
// и не прерывает остальные; 401 останавливает загрузку, сессию истекает кэш.
export async function uploadWorkFiles(
  files: File[],
  send: (file: File, idempotencyKey: string) => Promise<boolean>,
  setUploads: Dispatch<SetStateAction<Upload[]>>,
): Promise<number> {
  const batch: Upload[] = files.map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    state: 'uploading',
  }));
  const mark = (id: string, next: Partial<Upload>) => {
    setUploads((items) =>
      items.map((item) => (item.id === id ? { ...item, ...next } : item)),
    );
  };
  setUploads(batch);
  let accepted = 0;
  for (const [index, file] of files.entries()) {
    const id = batch[index]?.id ?? '';
    try {
      if (!(await send(file, newIdempotencyKey()))) {
        setUploads((items) => items.filter((item) => item.id !== id));
        continue;
      }
      accepted++;
      mark(id, { state: 'done' });
    } catch (failure) {
      if (isUnauthorized(failure)) break;
      mark(id, {
        state: 'failed',
        reason: uploadFailureMessage(file.name, failure),
      });
    }
  }
  return accepted;
}
