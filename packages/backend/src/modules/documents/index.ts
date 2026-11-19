// Публичный фасад распознавания документов. Модуль владеет исходниками, версиями разбора, результатами
// и артефактами; процессы работы и worker используют его только через этот файл и module.ts (тип).
import type { DocumentId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';

export { documentImageLimit } from '../../platform/document-output';

import type {
  DocumentDeletionImpact,
  DocumentListInput,
  DocumentPage,
  DocumentResult,
  DocumentView,
} from './application/ports';

export type {
  ArtifactRegistry,
  DocumentDeletionConfirmation,
  DocumentDeletionImpact,
  DocumentDeps,
  DocumentParser,
  DocumentResult,
  DocumentStore,
  DocumentView,
  ResourceLocks,
  SourceStorage,
} from './application/ports';
export { StorageWriteOutcomeUnknown } from './application/ports';
export { checksum } from './application/checksum';
export { documentLockKey } from './application/document-lock-key';
export {
  cloudImageOcrVersion,
  documentResultSchema,
} from './application/result-schema';
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
  revision: number;
  images: { path: string; index: number; checksum?: string }[];
  pdfOcr?: DocumentResult['pdfOcr'];
}

export interface DocumentImage {
  bytes: Uint8Array;
  contentType: string;
}

// Текст и изображения для анализа: читаются только из проверенного результата распознавания.
export interface DocumentAnalysis {
  text: string;
  pdfOcr?: DocumentResult['pdfOcr'];
  images: { path: string; bytes: Uint8Array; contentType: string }[];
  sourceDigest: string;
}

export type DocumentAnalysisSource = Pick<
  DocumentAnalysis,
  'text' | 'sourceDigest'
> & {
  imagePaths: string[];
};

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
export interface InternalResultRef extends InternalDocumentRef {
  revision?: number | null;
}

// Распознавание вне работы: каждая команда и запрос проверяют recognitions.use (ADR 0009).
export interface DocumentsCommands {
  upload(
    scope: WorkspaceScope,
    input: DocumentUploadInput,
  ): Promise<DocumentView>;
  remove(
    scope: WorkspaceScope,
    documentId: DocumentId,
    token?: string,
  ): Promise<void>;
  retry(
    scope: WorkspaceScope,
    documentId: DocumentId,
    correlationId: string,
  ): Promise<DocumentView>;
}

export interface DocumentsQueries {
  deletionImpact(
    scope: WorkspaceScope,
    documentId: DocumentId,
  ): Promise<DocumentDeletionImpact & { canDelete: boolean }>;
  list(scope: WorkspaceScope, input: DocumentListInput): Promise<DocumentPage>;
  pendingDeletions(scope: WorkspaceScope): Promise<PendingDocumentDeletion[]>;
  get(scope: WorkspaceScope, documentId: DocumentId): Promise<DocumentView>;
  result(
    scope: WorkspaceScope,
    documentId: DocumentId,
    revision?: number,
  ): Promise<DocumentResultView>;
  source(
    scope: WorkspaceScope,
    documentId: DocumentId,
  ): Promise<DocumentSourceFile>;
  image(
    scope: WorkspaceScope,
    documentId: DocumentId,
    index: number,
    revision?: number,
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
    get(input: InternalResultRef): Promise<DocumentView>;
    result(input: InternalResultRef): Promise<DocumentResultView>;
    source(input: InternalDocumentRef): Promise<DocumentSourceFile>;
    image(input: InternalResultRef & { index: number }): Promise<DocumentImage>;
    analysis(input: InternalResultRef): Promise<DocumentAnalysis>;
    analysisSource(input: InternalResultRef): Promise<DocumentAnalysisSource>;
  };
}

// Фасад модуля. Модуль не участвует в транзакции вызывающего: загрузка пишет в S3 и занимает блокировки,
// поэтому его команды открывают собственные короткие транзакции внутри runtime-хранилища.
export interface DocumentsModule {
  readonly commands: DocumentsCommands;
  readonly queries: DocumentsQueries;
  readonly internal: DocumentsInternal;
}
