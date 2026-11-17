import { z } from 'zod';

// Брендированные идентификаторы (ADR 0009). Значение получает бренд на границе: HTTP,
// задание, чтение из БД. Разбор здесь же, поэтому строка без проверки не становится ID.

declare const idBrand: unique symbol;
type Brand<Name extends string> = string & { readonly [idBrand]: Name };

export type WorkspaceId = Brand<'WorkspaceId'>;
export type UserId = Brand<'UserId'>;
export type WorkId = Brand<'WorkId'>;
export type DocumentId = Brand<'DocumentId'>;
export type GenerationId = Brand<'GenerationId'>;
export type FileId = Brand<'FileId'>;

// Идентификатор рабочей области не обязан быть UUID: у локальной области id `local`.
const workspaceIdPattern = /^[\w-]{1,128}$/;

// Вход, который не проверяли схемой, разбирается без исключения: вызывающий решает ответ.
export function parseWorkspaceId(value: string): WorkspaceId | null {
  return workspaceIdPattern.test(value) ? (value as WorkspaceId) : null;
}

export function parseUserId(value: string): UserId | null {
  return value.length > 0 ? (value as UserId) : null;
}

// ID наших сущностей проверяет схема contracts на входе; несовпадение здесь — ошибка контракта,
// поэтому исключение, а не тихий ответ.
const uuid = z.uuid();
function assertUuid(value: string, name: string): void {
  if (!uuid.safeParse(value).success) throw new Error(`INVALID_${name}_ID`);
}

export function brandWorkId(value: string): WorkId {
  assertUuid(value, 'WORK');
  return value as WorkId;
}

export function brandDocumentId(value: string): DocumentId {
  assertUuid(value, 'DOCUMENT');
  return value as DocumentId;
}

export function brandGenerationId(value: string): GenerationId {
  assertUuid(value, 'GENERATION');
  return value as GenerationId;
}

export function brandFileId(value: string): FileId {
  assertUuid(value, 'FILE');
  return value as FileId;
}

// UUIDv7 сортируется по времени создания. Сценарии получают генератор через зависимости
// (переход на него — этапы #19 и #4b); внутри домена ID не читаются из окружения.
export function uuidV7(): string {
  return Bun.randomUUIDv7();
}
