import type { Elysia } from 'elysia';

import {
  brandDocumentId,
  brandFileId,
  brandGenerationId,
  brandWorkId,
} from '@anyko/backend/ids';
import type {
  WorkDeletionApi,
  WorkGeneration,
  WorkIntake,
  WorkReview,
  WorkViews,
} from '@anyko/backend/workflows';
import type { WorksModule } from '@anyko/backend/works';
import {
  analyzeWork,
  confirmWork,
  createWork,
  deleteWork,
  downloadGeneratedFile,
  editWork,
  generateWork,
  getWork,
  getWorkDeletion,
  getWorkDocumentImage,
  getWorkDocumentResult,
  getWorkDocumentSource,
  listWorks,
  removeWorkDocument,
  streamWorkEvents,
  uploadWorkDocument,
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

import { workEventStream } from './events';

export interface WorkHttpOptions
  extends DocumentHttpOptions, ConnectionHttpOptions {
  // Фасад модуля works (запросы списка и событий) и процессы работы из runtime.
  works: WorksModule;
  views: WorkViews;
  intake: WorkIntake;
  deletion: WorkDeletionApi;
  review: WorkReview;
  generation: WorkGeneration;
}

const docxType =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function presentWork({
  discrepancyFields,
  facts,
  ...work
}: Awaited<ReturnType<WorkViews['get']>>): WorkView {
  return { ...work, facts: { ...facts, discrepancyFields } };
}

export function worksRoutes(
  route: Route,
  app: Elysia,
  options: WorkHttpOptions,
) {
  const { works, views, intake, review, generation, access, deletion } =
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
  route(app, deleteWork, ({ scope, params, requestId }) =>
    deletion.request(scope, brandWorkId(params.workId), requestId),
  );
  route(app, getWorkDeletion, ({ scope, params }) =>
    deletion.status(scope, brandWorkId(params.workId)),
  );
  route(app, createWork, async ({ scope, body }) =>
    presentWork(await views.get(scope, await intake.createWork(scope, body))),
  );
  route(app, getWork, async ({ scope, params }) =>
    presentWork(await views.get(scope, brandWorkId(params.workId))),
  );
  route(
    app,
    streamWorkEvents,
    async ({ scope, params, query, headers, request }) => {
      // Курсор: заголовок Last-Event-ID важнее параметра after, как и раньше.
      const after = headers['last-event-id'] ?? query.after ?? '0';
      const workId = brandWorkId(params.workId);
      await works.queries.events(scope, workId, after);
      return workEventStream({ request, scope, workId, after, works, access });
    },
  );
  route(
    app,
    uploadWorkDocument,
    async ({ scope, params, headers, body, requestId }) => ({
      document: await intake.uploadDocument(scope, {
        workId: brandWorkId(params.workId),
        filename: body.file.name,
        bytes: new Uint8Array(await body.file.arrayBuffer()),
        correlationId: requestId,
        requestKey: headers['idempotency-key'],
      }),
    }),
  );
  route(app, getWorkDocumentSource, async ({ scope, params }) => {
    const source = await views.source(
      scope,
      brandWorkId(params.workId),
      brandDocumentId(params.documentId),
    );
    return { bytes: source.bytes, headers: sourceFileHeaders(source) };
  });
  route(app, getWorkDocumentResult, async ({ scope, params, link }) => {
    const result = await views.result(
      scope,
      brandWorkId(params.workId),
      brandDocumentId(params.documentId),
    );
    return {
      markdown: result.markdown,
      processorVersion: result.processorVersion,
      // Изображения адресуются через работу: ссылка ведёт на изображение исходного документа работы.
      images: result.images.map((image) => ({
        path: image.path,
        url: link(getWorkDocumentImage, {
          workspaceId: scope.workspaceId,
          workId: params.workId,
          documentId: params.documentId,
          index: String(image.index),
        }),
      })),
    };
  });
  route(app, getWorkDocumentImage, async ({ scope, params }) => {
    const image = await views.image(
      scope,
      brandWorkId(params.workId),
      brandDocumentId(params.documentId),
      imageIndex(params.index),
    );
    return { bytes: image.bytes, headers: imageHeaders(image.contentType) };
  });
  route(app, analyzeWork, async ({ scope, params, requestId }) => {
    await intake.analyzeWork(scope, {
      workId: brandWorkId(params.workId),
      correlationId: requestId,
    });
    return { status: 'queued' as const };
  });
  route(app, removeWorkDocument, async ({ scope, params }) => {
    await intake.removeDocument(scope, {
      workId: brandWorkId(params.workId),
      documentId: brandDocumentId(params.documentId),
    });
    return { status: 'deleting' as const };
  });
  route(app, editWork, async ({ scope, params, body }) => {
    const workId = brandWorkId(params.workId);
    await review.editValues(scope, { ...body, workId });
    return presentWork(await views.get(scope, workId));
  });
  route(app, confirmWork, async ({ scope, params, body }) => {
    const workId = brandWorkId(params.workId);
    await review.confirmFacts(scope, { ...body, workId });
    return presentWork(await views.get(scope, workId));
  });
  route(app, generateWork, async ({ scope, params, body, requestId }) => {
    await generation.startGeneration(scope, {
      ...body,
      workId: brandWorkId(params.workId),
      correlationId: requestId,
    });
    return { status: 'queued' as const };
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
