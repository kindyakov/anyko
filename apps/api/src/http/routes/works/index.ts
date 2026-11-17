import type { Elysia } from 'elysia';

import type { WorkApi } from '@anyko/backend/works';
import {
  analyzeWork,
  confirmWork,
  createWork,
  downloadGeneratedFile,
  editWork,
  generateWork,
  getWork,
  listWorks,
  removeWorkDocument,
  streamWorkEvents,
  uploadWorkDocument,
} from '@anyko/contracts/works';

import type { Route } from '../../route';
import type { ConnectionHttpOptions } from '../connections';
import type { DocumentHttpOptions } from '../documents';

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
  route(app, listWorks, ({ session, query }) =>
    works.list(session.workspace.id, query.after || undefined),
  );
  route(app, createWork, ({ session, body }) =>
    works.create({
      ...body,
      workspaceId: session.workspace.id,
      actorId: session.user.id,
    }),
  );
  route(app, getWork, ({ session, params }) =>
    works.get(session.workspace.id, params.workId),
  );
  route(
    app,
    streamWorkEvents,
    async ({ session, params, query, headers, request }) => {
      // Курсор: заголовок Last-Event-ID важнее параметра after, как и раньше.
      const after = headers['last-event-id'] ?? query.after ?? '0';
      await works.events(session.workspace.id, params.workId, after);
      return workEventStream({
        request,
        workId: params.workId,
        workspaceId: session.workspace.id,
        userId: session.user.id,
        after,
        works,
        access,
      });
    },
  );
  route(
    app,
    uploadWorkDocument,
    async ({ session, params, headers, body, requestId }) => ({
      document: await works.upload({
        workspaceId: session.workspace.id,
        workId: params.workId,
        actorId: session.user.id,
        filename: body.file.name,
        bytes: new Uint8Array(await body.file.arrayBuffer()),
        correlationId: requestId,
        requestKey: headers['idempotency-key'],
      }),
    }),
  );
  route(app, analyzeWork, async ({ session, params, requestId }) => {
    await works.analyze({
      workspaceId: session.workspace.id,
      workId: params.workId,
      actorId: session.user.id,
      correlationId: requestId,
    });
    return { status: 'queued' as const };
  });
  route(app, removeWorkDocument, async ({ session, params }) => {
    await works.removeDocument({
      workspaceId: session.workspace.id,
      workId: params.workId,
      documentId: params.documentId,
    });
    return { status: 'deleting' as const };
  });
  route(app, editWork, ({ session, params, body }) =>
    works.edit({
      ...body,
      workspaceId: session.workspace.id,
      workId: params.workId,
    }),
  );
  route(app, confirmWork, ({ session, params, body }) =>
    works.confirm({
      ...body,
      workspaceId: session.workspace.id,
      workId: params.workId,
    }),
  );
  route(app, generateWork, async ({ session, params, body, requestId }) => {
    await works.generate({
      ...body,
      workspaceId: session.workspace.id,
      workId: params.workId,
      actorId: session.user.id,
      correlationId: requestId,
    });
    return { status: 'queued' as const };
  });
  route(app, downloadGeneratedFile, async ({ session, params }) => {
    const result = await works.download(
      session.workspace.id,
      params.workId,
      params.generationId,
      params.fileId,
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
