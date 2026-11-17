import type { Elysia } from 'elysia';

import {
  brandDocumentId,
  brandFileId,
  brandGenerationId,
  brandWorkId,
} from '@anyko/backend/ids';
import type { WorkApi } from '@anyko/backend/works';
import {
  analyzeWork,
  confirmWork,
  createWork,
  downloadGeneratedFile,
  editWork,
  generateWork,
  getWork,
  getWorkDocumentImage,
  getWorkDocumentSource,
  listWorks,
  removeWorkDocument,
  streamWorkEvents,
  uploadWorkDocument,
} from '@anyko/contracts/works';

import type { Route } from '../../route';
import type { ConnectionHttpOptions } from '../connections';
import type { DocumentHttpOptions } from '../documents';
import {
  imageHeaders,
  imageIndex,
  sourceFileHeaders,
} from '../documents/files';

import { workEventStream } from './events';

export interface WorkHttpOptions
  extends DocumentHttpOptions, ConnectionHttpOptions {
  works: WorkApi;
}

const docxType =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function worksRoutes(
  route: Route,
  app: Elysia,
  options: WorkHttpOptions,
) {
  const { works, access } = options;
  route(app, listWorks, ({ scope, query }) =>
    works.list(scope, query.after || undefined),
  );
  route(app, createWork, ({ scope, body }) => works.create(scope, body));
  route(app, getWork, ({ scope, params }) =>
    works.get(scope, brandWorkId(params.workId)),
  );
  route(
    app,
    streamWorkEvents,
    async ({ scope, params, query, headers, request }) => {
      // Курсор: заголовок Last-Event-ID важнее параметра after, как и раньше.
      const after = headers['last-event-id'] ?? query.after ?? '0';
      const workId = brandWorkId(params.workId);
      await works.events(scope, workId, after);
      return workEventStream({ request, scope, workId, after, works, access });
    },
  );
  route(
    app,
    uploadWorkDocument,
    async ({ scope, params, headers, body, requestId }) => ({
      document: await works.upload(scope, {
        workId: brandWorkId(params.workId),
        filename: body.file.name,
        bytes: new Uint8Array(await body.file.arrayBuffer()),
        correlationId: requestId,
        requestKey: headers['idempotency-key'],
      }),
    }),
  );
  route(app, getWorkDocumentSource, async ({ scope, params }) => {
    const source = await works.source(
      scope,
      brandWorkId(params.workId),
      brandDocumentId(params.documentId),
    );
    return { bytes: source.bytes, headers: sourceFileHeaders(source) };
  });
  route(app, getWorkDocumentImage, async ({ scope, params }) => {
    const image = await works.image(
      scope,
      brandWorkId(params.workId),
      brandDocumentId(params.documentId),
      imageIndex(params.index),
    );
    return { bytes: image.bytes, headers: imageHeaders(image.contentType) };
  });
  route(app, analyzeWork, async ({ scope, params, requestId }) => {
    await works.analyze(scope, {
      workId: brandWorkId(params.workId),
      correlationId: requestId,
    });
    return { status: 'queued' as const };
  });
  route(app, removeWorkDocument, async ({ scope, params }) => {
    await works.removeDocument(scope, {
      workId: brandWorkId(params.workId),
      documentId: brandDocumentId(params.documentId),
    });
    return { status: 'deleting' as const };
  });
  route(app, editWork, ({ scope, params, body }) =>
    works.edit(scope, { ...body, workId: brandWorkId(params.workId) }),
  );
  route(app, confirmWork, ({ scope, params, body }) =>
    works.confirm(scope, { ...body, workId: brandWorkId(params.workId) }),
  );
  route(app, generateWork, async ({ scope, params, body, requestId }) => {
    await works.generate(scope, {
      ...body,
      workId: brandWorkId(params.workId),
      correlationId: requestId,
    });
    return { status: 'queued' as const };
  });
  route(app, downloadGeneratedFile, async ({ scope, params }) => {
    const result = await works.download(
      scope,
      brandWorkId(params.workId),
      brandGenerationId(params.generationId),
      brandFileId(params.fileId),
    );
    return {
      bytes: result.bytes,
      headers: {
        'content-type': docxType,
        'content-disposition': `attachment; filename="${result.filename}"`,
      },
    };
  });
}
