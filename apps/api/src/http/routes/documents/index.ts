import type { Elysia } from 'elysia';

import type { createAccess } from '@anyko/backend/access';
import type { DocumentsModule } from '@anyko/backend/documents';
import type { IdempotencyApi } from '@anyko/backend/idempotency';
import { brandDocumentId } from '@anyko/backend/ids';
import {
  deleteDocument,
  getDocument,
  getDocumentDeletion,
  getDocumentImage,
  getDocumentResult,
  getDocumentSource,
  listDocuments,
  retryDocument,
  uploadDocument,
} from '@anyko/contracts/documents';

import type { Route } from '../../route';

import { imageHeaders, imageIndex, sourceFileHeaders } from './files';
import { presentDocumentResult } from './result';
import { documentSummary } from './summary';

export interface DocumentHttpOptions {
  documents: DocumentsModule;
  access: ReturnType<typeof createAccess>;
  origin: string;
  idempotency: IdempotencyApi;
}

// Распознавание вне работы: сценарии на модуле documents. Адреса и область строит маршрут,
// право recognitions.use проверяет сценарий.
export function documentRoutes(
  route: Route,
  app: Elysia,
  options: Pick<DocumentHttpOptions, 'documents'>,
) {
  const { documents } = options;
  route(app, listDocuments, async ({ scope, query }) => {
    const page = await documents.queries.list(scope, query);
    return {
      ...page,
      items: page.items.map(documentSummary),
      pendingDeletions: await documents.queries.pendingDeletions(scope),
    };
  });
  route(app, uploadDocument, async ({ scope, headers, body, requestId }) => {
    const document = await documents.commands.upload(scope, {
      requestKey: headers['idempotency-key'],
      filename: body.file.name,
      bytes: new Uint8Array(await body.file.arrayBuffer()),
      correlationId: requestId,
    });
    return {
      body: { document: documentSummary(document) },
      resource: { kind: 'document' as const, id: document.id },
    };
  });
  route(app, getDocument, async ({ scope, params }) => ({
    document: documentSummary(
      await documents.queries.get(scope, brandDocumentId(params.documentId)),
    ),
  }));
  route(app, getDocumentResult, async ({ scope, params, link }) => {
    const result = await documents.queries.result(
      scope,
      brandDocumentId(params.documentId),
    );
    return presentDocumentResult(result, (index) =>
      link(getDocumentImage, {
        workspaceId: scope.workspaceId,
        documentId: params.documentId,
        index,
      }),
    );
  });
  route(app, getDocumentSource, async ({ scope, params }) => {
    const source = await documents.queries.source(
      scope,
      brandDocumentId(params.documentId),
    );
    return {
      bytes: source.bytes,
      headers: sourceFileHeaders(source),
    };
  });
  route(app, getDocumentImage, async ({ scope, params }) => {
    const image = await documents.queries.image(
      scope,
      brandDocumentId(params.documentId),
      imageIndex(params.index),
    );
    return {
      bytes: image.bytes,
      headers: imageHeaders(image.contentType),
    };
  });
  route(app, getDocumentDeletion, ({ scope, params }) =>
    documents.queries.deletion(scope, brandDocumentId(params.documentId)),
  );
  route(app, deleteDocument, async ({ scope, params }) => {
    await documents.commands.remove(scope, brandDocumentId(params.documentId));
    return { status: 'deleting' as const };
  });
  route(app, retryDocument, async ({ scope, params, requestId }) => ({
    document: documentSummary(
      await documents.commands.retry(
        scope,
        brandDocumentId(params.documentId),
        requestId,
      ),
    ),
  }));
}
