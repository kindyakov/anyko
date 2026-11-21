import type { Elysia } from 'elysia';

import {
  brandDocumentId,
  brandFileId,
  brandGenerationId,
  brandWorkId,
} from '@anyko/backend/ids';
import type {
  WorkChat,
  WorkDeletionApi,
  WorkGeneration,
  WorkIntake,
  WorkReview,
  WorkViews,
} from '@anyko/backend/workflows';
import type { WorksModule } from '@anyko/backend/works';
import {
  analyzeWork,
  attachWorkDocuments,
  confirmWork,
  createWork,
  createWorkChatMessage,
  deleteWork,
  downloadGeneratedFile,
  editWork,
  editWorkChecklistLink,
  editWorkDocumentRecognition,
  generateWork,
  getWork,
  getWorkAgentHistory,
  getWorkDeletion,
  getWorkDocumentImage,
  getWorkDocumentResult,
  getWorkDocumentSource,
  listWorkAnalysisRuns,
  listWorkChatMessages,
  listWorks,
  removeWorkDocument,
  streamWorkEvents,
  uploadWorkDocument,
  workChatTimeline,
  workRunSchema,
  type WorkView,
} from '@anyko/contracts/works';

import type { Route } from '../../route';
import type { ConnectionHttpOptions } from '../connections';
import type { DocumentHttpOptions } from '../documents';
import {
  imageHeaders,
  imageIndex,
  sourceFileHeaders,
} from '../documents/files';
import { presentDocumentResult } from '../documents/result';

import { workEventStream } from './events';

export interface WorkHttpOptions
  extends DocumentHttpOptions, ConnectionHttpOptions {
  // Фасад модуля works (запросы списка и событий) и процессы работы из runtime.
  works: WorksModule;
  views: WorkViews;
  chat: WorkChat;
  intake: WorkIntake;
  deletion: WorkDeletionApi;
  review: WorkReview;
  generation: WorkGeneration;
}

const docxType =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function presentWork({
  availability,
  discrepancyFields,
  facts,
  ...work
}: Awaited<ReturnType<WorkViews['get']>>): WorkView {
  return { ...work, availability, facts: { ...facts, discrepancyFields } };
}

export function worksRoutes(
  route: Route,
  app: Elysia,
  options: WorkHttpOptions,
) {
  const { works, views, chat, intake, review, generation, access, deletion } =
    options;
  route(app, listWorks, async ({ scope, query }) => {
    const page = await works.queries.list(scope, {
      page: query.page,
      pageSize: query.pageSize,
      q: query.q ?? '',
      status: query.status ?? 'all',
    });
    return { ...page, deletions: await deletion.pending(scope) };
  });
  route(app, deleteWork, ({ scope, params, correlationId }) =>
    deletion.request(scope, brandWorkId(params.workId), correlationId),
  );
  route(app, getWorkDeletion, ({ scope, params }) =>
    deletion.status(scope, brandWorkId(params.workId)),
  );
  route(app, createWork, async ({ scope, body }) => {
    const workId = await intake.createWork(scope, body);
    const view = await views.get(scope, workId);
    return {
      body: presentWork(view),
      resource: {
        kind: 'work' as const,
        id: workId,
        documentIds: view.documents.map(({ id }) => id),
      },
    };
  });
  route(app, getWork, async ({ scope, params }) =>
    presentWork(await views.get(scope, brandWorkId(params.workId))),
  );
  route(app, listWorkAnalysisRuns, async ({ scope, params, query }) => {
    const page = await views.listAgentHistoryRuns(
      scope,
      brandWorkId(params.workId),
      query.page,
      query.pageSize,
    );
    return {
      ...page,
      items: page.items.map((run) => ({
        ...run,
        status: workRunSchema.shape.status.parse(run.status),
      })),
    };
  });
  route(app, getWorkAgentHistory, ({ scope, params, query }) =>
    views.agentHistory(
      scope,
      brandWorkId(params.workId),
      params.runId,
      query.page,
      query.pageSize,
    ),
  );
  route(app, listWorkChatMessages, async ({ scope, params, query }) =>
    workChatTimeline.parse(
      await chat.list(scope, {
        workId: brandWorkId(params.workId),
        ...query,
      }),
    ),
  );
  route(
    app,
    createWorkChatMessage,
    async ({ scope, params, body, correlationId }) => {
      const workId = brandWorkId(params.workId);
      return {
        body: await chat.send(scope, {
          workId,
          ...body,
          correlationId,
        }),
        resource: { kind: 'work' as const, id: workId, documentIds: [] },
      };
    },
  );
  route(
    app,
    streamWorkEvents,
    async ({ scope, params, query, headers, request }) => {
      // Курсор: заголовок Last-Event-ID важнее параметра after, как и раньше.
      const [after = '0', chatAfter = '0-0'] = (
        headers['last-event-id'] ??
        query.after ??
        '0'
      ).split('|');
      const workId = brandWorkId(params.workId);
      await works.queries.events(scope, workId, after);
      return workEventStream({
        request,
        scope,
        workId,
        after,
        chatAfter,
        works,
        access,
        progress: chat.progress,
        progressActive: chat.progressActive,
      });
    },
  );
  route(
    app,
    uploadWorkDocument,
    async ({ scope, params, headers, body, correlationId }) => {
      const document = await intake.uploadDocument(scope, {
        workId: brandWorkId(params.workId),
        filename: body.file.name,
        bytes: new Uint8Array(await body.file.arrayBuffer()),
        correlationId,
        requestKey: headers['idempotency-key'],
      });
      return {
        body: { document },
        resource: { kind: 'document' as const, id: document.id },
      };
    },
  );
  route(app, getWorkDocumentSource, async ({ scope, params }) => {
    const source = await views.source(
      scope,
      brandWorkId(params.workId),
      brandDocumentId(params.documentId),
    );
    return { bytes: source.bytes, headers: sourceFileHeaders(source) };
  });
  route(app, attachWorkDocuments, async ({ scope, params, body }) => {
    await intake.attachDocuments(scope, {
      workId: brandWorkId(params.workId),
      documentIds: body.documentIds,
    });
    return { status: 'attached' as const };
  });
  route(app, getWorkDocumentResult, async ({ scope, params, query, link }) => {
    const result = await views.result(
      scope,
      brandWorkId(params.workId),
      brandDocumentId(params.documentId),
      query.revision,
    );
    return presentDocumentResult(result, (index) =>
      link(getWorkDocumentImage, {
        workspaceId: scope.workspaceId,
        workId: params.workId,
        documentId: params.documentId,
        index,
      }),
    );
  });
  route(app, getWorkDocumentImage, async ({ scope, params, query }) => {
    const image = await views.image(
      scope,
      brandWorkId(params.workId),
      brandDocumentId(params.documentId),
      imageIndex(params.index),
      query.revision,
    );
    return { bytes: image.bytes, headers: imageHeaders(image.contentType) };
  });
  route(app, analyzeWork, async ({ scope, params, correlationId }) => {
    await intake.analyzeWork(scope, {
      workId: brandWorkId(params.workId),
      correlationId,
    });
    return { body: { status: 'queued' as const }, resource: null };
  });
  route(app, removeWorkDocument, async ({ scope, params }) => {
    await intake.removeDocument(scope, {
      workId: brandWorkId(params.workId),
      documentId: brandDocumentId(params.documentId),
    });
    return { status: 'deleting' as const };
  });
  route(app, editWorkDocumentRecognition, async ({ scope, params, body }) => {
    await intake.updateRecognition(scope, {
      workId: brandWorkId(params.workId),
      documentId: brandDocumentId(params.documentId),
      ocrRevision: body.ocrRevision,
    });
    return { status: 'updated' as const };
  });
  route(app, editWorkChecklistLink, async ({ scope, params, body }) => {
    await review.editChecklistLink(scope, {
      workId: brandWorkId(params.workId),
      documentId: brandDocumentId(params.documentId),
      requirementKey: params.requirementId,
      ...body,
    });
    return { status: 'updated' as const };
  });
  route(app, editWork, async ({ scope, params, body }) => {
    const workId = brandWorkId(params.workId);
    if ('restore' in body) {
      await review.restoreField(scope, {
        workId,
        revision: body.revision,
        ...body.restore,
      });
    } else {
      await review.editValues(scope, { ...body, workId });
    }
    return presentWork(await views.get(scope, workId));
  });
  route(app, confirmWork, async ({ scope, params, body }) => {
    const workId = brandWorkId(params.workId);
    await review.confirmFacts(scope, { ...body, workId });
    return presentWork(await views.get(scope, workId));
  });
  route(app, generateWork, async ({ scope, params, body, correlationId }) => {
    await generation.startGeneration(scope, {
      ...body,
      workId: brandWorkId(params.workId),
      correlationId,
    });
    return { body: { status: 'queued' as const }, resource: null };
  });
  route(app, downloadGeneratedFile, async ({ scope, params }) => {
    const result = await generation.downloadResult(scope, {
      workId: brandWorkId(params.workId),
      generationId: brandGenerationId(params.generationId),
      fileId: brandFileId(params.fileId),
    });
    return {
      bytes: result.bytes,
      headers: {
        'content-type': docxType,
        'content-disposition': `attachment; filename="${result.filename}"`,
      },
    };
  });
}
