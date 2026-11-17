// Публичный фасад распознавания документов. Модуль владеет исходниками, версиями разбора, результатами
// и артефактами; процессы работы и worker используют его только через этот файл и module.ts (тип).
import type { DocumentId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';

import type { DocumentView } from './application/ports';

export type {
  ArtifactRegistry,
  DocumentDeps,
  DocumentIo,
  DocumentParser,
  DocumentResult,
  DocumentStore,
  DocumentView,
  ResourceLocks,
  SourceStorage,
} from './application/ports';
export { StorageWriteOutcomeUnknown } from './application/ports';
export { checksum } from './application/checksum';
export { documentResultSchema } from './application/result-schema';
export type { SourceFormat } from './application/source-format';
export { sourceFormatFromKey } from './application/source-format';
export { DocumentError, DocumentErrors } from './errors';

export interface DocumentUploadInput {
  filename: string;
  bytes: Uint8Array;
  correlationId: string;
  requestKey: string;
}

export interface DocumentSourceFile {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}

export interface DocumentResultView {
  markdown: string;
  processorVersion: string;
  images: { path: string; index: number }[];
}

export interface DocumentImage {
  bytes: Uint8Array;
  contentType: string;
}

// Текст и изображения для анализа: читаются только из проверенного результата распознавания.
export interface DocumentAnalysis {
  text: string;
  images: { path: string; bytes: Uint8Array; contentType: string }[];
  sourceDigest: string;
}

export type DocumentDeletionStatus = 'deleting' | 'deleted' | 'needs-recovery';

export interface PendingDocumentDeletion {
  id: string;
  createdAt: string;
  status: 'deleting' | 'needs-recovery';
}

// Внутренние операции вызывает процесс, который уже проверил своё право (документ работы или worker);
// workspaceId приходит из доверенного контекста вызывающего.
export interface InternalUploadInput extends DocumentUploadInput {
  workspaceId: string;
  actorId: string;
}
export interface InternalDocumentRef {
  workspaceId: string;
  documentId: string;
}

// Распознавание вне работы: каждая команда и запрос проверяют recognitions.use (ADR 0009).
export interface DocumentsCommands {
  upload(
    scope: WorkspaceScope,
    input: DocumentUploadInput,
  ): Promise<DocumentView>;
  remove(scope: WorkspaceScope, documentId: DocumentId): Promise<void>;
  retry(
    scope: WorkspaceScope,
    documentId: DocumentId,
    correlationId: string,
  ): Promise<DocumentView>;
}

export interface DocumentsQueries {
  list(scope: WorkspaceScope): Promise<DocumentView[]>;
  pendingDeletions(scope: WorkspaceScope): Promise<PendingDocumentDeletion[]>;
  get(scope: WorkspaceScope, documentId: DocumentId): Promise<DocumentView>;
  result(
    scope: WorkspaceScope,
    documentId: DocumentId,
  ): Promise<DocumentResultView>;
  source(
    scope: WorkspaceScope,
    documentId: DocumentId,
  ): Promise<DocumentSourceFile>;
  image(
    scope: WorkspaceScope,
    documentId: DocumentId,
    index: number,
  ): Promise<DocumentImage>;
  deletion(
    scope: WorkspaceScope,
    documentId: DocumentId,
  ): Promise<{ status: DocumentDeletionStatus }>;
}

export interface DocumentsInternal {
  readonly commands: {
    upload(input: InternalUploadInput): Promise<DocumentView>;
    remove(input: InternalDocumentRef & { actorId: string }): Promise<void>;
    retry(
      input: InternalDocumentRef & { actorId: string; correlationId: string },
    ): Promise<DocumentView>;
  };
  readonly queries: {
    get(input: InternalDocumentRef): Promise<DocumentView>;
    result(input: InternalDocumentRef): Promise<DocumentResultView>;
    source(input: InternalDocumentRef): Promise<DocumentSourceFile>;
    image(
      input: InternalDocumentRef & { index: number },
    ): Promise<DocumentImage>;
    analysis(input: InternalDocumentRef): Promise<DocumentAnalysis>;
  };
}

// Фасад модуля. Модуль не участвует в транзакции вызывающего: загрузка пишет в S3 и занимает блокировки,
// поэтому его команды открывают собственные короткие транзакции внутри runtime-хранилища.
export interface DocumentsModule {
  readonly commands: DocumentsCommands;
  readonly queries: DocumentsQueries;
  readonly internal: DocumentsInternal;
}
