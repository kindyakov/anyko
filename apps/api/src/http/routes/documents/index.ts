import type { Elysia } from 'elysia';

import type { createAccess } from '@anyko/backend/access';
import type { createDocumentService } from '@anyko/backend/documents';
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

export interface DocumentHttpOptions {
  documents: ReturnType<typeof createDocumentService>;
  access: ReturnType<typeof createAccess>;
  origin: string;
}

const sandboxed = "default-src 'none'; sandbox";

export function documentRoutes(
  route: Route,
  app: Elysia,
  options: Pick<DocumentHttpOptions, 'documents'>,
) {
  const { documents } = options;
  route(app, listDocuments, async ({ session }) => ({
    documents: await documents.list({ workspaceId: session.workspace.id }),
    deletions: await documents.pendingDeletions({
      workspaceId: session.workspace.id,
    }),
  }));
  route(app, uploadDocument, async ({ session, headers, body, requestId }) => ({
    document: await documents.upload({
      workspaceId: session.workspace.id,
      actorId: session.user.id,
      filename: body.file.name,
      requestKey: headers['idempotency-key'],
      bytes: new Uint8Array(await body.file.arrayBuffer()),
      correlationId: requestId,
    }),
  }));
  route(app, getDocument, async ({ session, params }) => ({
    document: await documents.get({
      workspaceId: session.workspace.id,
      documentId: params.documentId,
    }),
  }));
  route(app, getDocumentResult, ({ session, params }) =>
    documents.result({
      workspaceId: session.workspace.id,
      documentId: params.documentId,
    }),
  );
  route(app, getDocumentSource, async ({ session, params }) => {
    const source = await documents.source({
      workspaceId: session.workspace.id,
      documentId: params.documentId,
    });
    return {
      bytes: source.bytes,
      headers: {
        'content-type': source.contentType,
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(source.filename)}`,
        'content-security-policy': sandboxed,
      },
    };
  });
  route(app, getDocumentImage, async ({ session, params }) => {
    // Индекс не в диапазоне даёт -1: сервис вернёт NOT_FOUND, как и раньше.
    const index = /^\d{1,2}$/.test(params.index) ? Number(params.index) : -1;
    const image = await documents.image({
      workspaceId: session.workspace.id,
      documentId: params.documentId,
      index,
    });
    return {
      bytes: image.bytes,
      headers: {
        'content-type': image.contentType,
        'content-security-policy': sandboxed,
      },
    };
  });
  route(app, getDocumentDeletion, ({ session, params }) =>
    documents.deletion({
      workspaceId: session.workspace.id,
      documentId: params.documentId,
    }),
  );
  route(app, deleteDocument, async ({ session, params }) => {
    await documents.remove({
      workspaceId: session.workspace.id,
      documentId: params.documentId,
    });
    return { status: 'deleting' as const };
  });
  route(app, retryDocument, async ({ session, params, requestId }) => ({
    document: await documents.retry({
      workspaceId: session.workspace.id,
      documentId: params.documentId,
      actorId: session.user.id,
      correlationId: requestId,
    }),
  }));
}
