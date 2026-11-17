import type { Dispatch, SetStateAction } from 'react';
import { z } from 'zod';

import { documentResponseSchema } from '@anyko/contracts';

import { requestApi } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

import { uploadFailureMessage } from '../upload-errors';

export interface Upload {
  id: string;
  name: string;
  state: 'uploading' | 'done' | 'failed';
  reason?: string;
}

const accepted = z.object({ status: z.string() });

// Загружает файлы по одному. Ошибка одного файла отмечается в списке и не прерывает остальные;
// 401 останавливает загрузку и возвращается вызывающему для истечения сессии.
export async function uploadWorkFiles(
  workId: string,
  files: File[],
  setUploads: Dispatch<SetStateAction<Upload[]>>,
): Promise<'finished' | 'unauthorized'> {
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
  for (const [index, file] of files.entries()) {
    const id = batch[index]?.id ?? '';
    const data = new FormData();
    data.set('file', file);
    try {
      await requestApi(`/works/${workId}/documents`, documentResponseSchema, {
        method: 'POST',
        body: data,
        headers: { 'idempotency-key': crypto.randomUUID() },
        timeoutMs: 60000,
      });
      mark(id, { state: 'done' });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401)
        return 'unauthorized';
      mark(id, {
        state: 'failed',
        reason: uploadFailureMessage(file.name, failure),
      });
    }
  }
  return 'finished';
}

export function deleteWorkDocument(workId: string, documentId: string) {
  return requestApi(`/works/${workId}/documents/${documentId}`, accepted, {
    method: 'DELETE',
  });
}
