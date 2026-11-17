import { workResponseSchema } from '@anyko/contracts';

import { checksum } from '../../modules/documents';
import { confirmFacts, editFacts, emptyFacts } from '../../modules/facts';
import { availablePackages, requirePackage } from '../../modules/templates';
import { type WorkApi, WorkError } from '../../modules/works';

import type { WorkDependencies } from './ports';

// Права работы: просмотр — works.read, правка и подтверждение — works.edit, генерация —
// works.generate, исходники — documents.upload и documents.delete. Проверка до любого чтения.
export function createWorkApi(deps: WorkDependencies): WorkApi {
  const requireWork = async (workspaceId: string, workId: string) => {
    const work = await deps.works.get(workspaceId, workId);
    if (!work) throw new WorkError('NOT_FOUND');
    return work;
  };
  const requireWorkDocument = async (
    workspaceId: string,
    workId: string,
    documentId: string,
  ) => {
    const docs = await deps.works.documents(workspaceId, workId);
    // Документ другой работы и удалённый документ для этой работы не существуют.
    if (!docs.some((doc) => doc.id === documentId && !doc.deleted))
      throw new WorkError('NOT_FOUND');
  };
  const requireClean = async (workspaceId: string, workId: string) => {
    const docs = await deps.works.documents(workspaceId, workId);
    if (
      docs.some((doc) => doc.deleted) ||
      !(await deps.workIo.clean(workspaceId, workId))
    )
      throw new WorkError('CLEANUP_PENDING');
    return docs;
  };
  const read = async (workspaceId: string, workId: string) => {
    // Read cursor first: concurrent changes may be delivered twice, never skipped.
    const cursor = await deps.works.cursor(workspaceId, workId);
    const work = await requireWork(workspaceId, workId);
    const rows = await deps.works.documents(workspaceId, workId);
    const cleanupPending =
      rows.some((row) => row.deleted) ||
      !(await deps.workIo.clean(workspaceId, workId));
    const documents = [];
    for (const row of rows)
      if (!row.deleted) {
        try {
          documents.push(
            await deps.documents.get({ workspaceId, documentId: row.id }),
          );
        } catch (error) {
          if (!(error instanceof Error && error.message === 'NOT_FOUND'))
            throw error;
        }
      }
    return workResponseSchema.parse({
      work,
      session: cleanupPending
        ? null
        : await deps.sessions.get(workspaceId, workId),
      package: requirePackage(work.packageVersion),
      documents,
      facts: cleanupPending
        ? emptyFacts()
        : await deps.facts.get(workspaceId, workId),
      runs: cleanupPending
        ? []
        : await deps.processing.list(workspaceId, workId),
      generations: cleanupPending
        ? []
        : await deps.generation.list(workspaceId, workId),
      cursor,
      cleanupPending,
    });
  };
  const locked = <T>(
    workspaceId: string,
    workId: string,
    operation: () => Promise<T>,
  ) => deps.locks.run(`work:${workspaceId}:${workId}`, operation);
  const get: WorkApi['get'] = async (scope, workId) => {
    scope.require('works.read');
    return locked(scope.workspaceId, workId, () =>
      read(scope.workspaceId, workId),
    );
  };
  return {
    async removeDocument(scope, input) {
      scope.require('documents.delete');
      await locked(scope.workspaceId, input.workId, async () => {
        await requireWork(scope.workspaceId, input.workId);
        const docs = await deps.works.documents(
          scope.workspaceId,
          input.workId,
        );
        if (!docs.some((doc) => doc.id === input.documentId))
          throw new WorkError('NOT_FOUND');
        await deps.documents.remove({
          workspaceId: scope.workspaceId,
          documentId: input.documentId,
          actorId: scope.userId,
        });
        await deps.works.event(
          scope.workspaceId,
          input.workId,
          'sources.deleting',
        );
      });
    },
    packages: availablePackages,
    async list(scope, after) {
      scope.require('works.read');
      if (after) await requireWork(scope.workspaceId, after);
      const rows = await deps.works.list(scope.workspaceId, after);
      const works = rows.slice(0, 50);
      return {
        works,
        nextCursor: rows.length > 50 ? (works.at(-1)?.id ?? null) : null,
      };
    },
    get,
    async create(scope, input) {
      scope.require('works.create');
      try {
        requirePackage(input.packageVersion);
      } catch {
        throw new WorkError('INVALID_WORK_INPUT');
      }
      const id = crypto.randomUUID();
      await deps.transaction(async ({ works, sessions }) => {
        await works.create({
          id,
          workspaceId: scope.workspaceId,
          title: input.title,
          packageVersion: input.packageVersion,
          actorId: scope.userId,
        });
        await sessions.ensure(scope.workspaceId, id);
        await works.event(scope.workspaceId, id, 'work.created');
      });
      return locked(scope.workspaceId, id, () => read(scope.workspaceId, id));
    },
    async upload(scope, input) {
      scope.require('documents.upload');
      return locked(scope.workspaceId, input.workId, async () => {
        await requireWork(scope.workspaceId, input.workId);
        const sources = await requireClean(scope.workspaceId, input.workId);
        if (sources.length >= 20) throw new WorkError('INVALID_WORK_INPUT');
        const document = await deps.documents.upload({
          workspaceId: scope.workspaceId,
          actorId: scope.userId,
          filename: input.filename,
          bytes: input.bytes,
          correlationId: input.correlationId,
          requestKey: input.requestKey,
        });
        await deps.transaction(async ({ works }) => {
          const linked = await works.documents(scope.workspaceId, input.workId);
          if (!linked.some((row) => row.id === document.id)) {
            await works.attach(scope.workspaceId, input.workId, document.id);
            await works.touch(scope.workspaceId, input.workId, {
              inputChanged: true,
            });
            await works.event(
              scope.workspaceId,
              input.workId,
              'documents.changed',
            );
          }
        });
        return document;
      });
    },
    async source(scope, workId, documentId) {
      scope.require('works.read');
      await requireWork(scope.workspaceId, workId);
      await requireWorkDocument(scope.workspaceId, workId, documentId);
      return deps.documents.source({
        workspaceId: scope.workspaceId,
        documentId,
      });
    },
    async image(scope, workId, documentId, index) {
      scope.require('works.read');
      await requireWork(scope.workspaceId, workId);
      await requireWorkDocument(scope.workspaceId, workId, documentId);
      return deps.documents.image({
        workspaceId: scope.workspaceId,
        documentId,
        index,
      });
    },
    async analyze(scope, input) {
      scope.require('works.edit');
      await locked(scope.workspaceId, input.workId, async () => {
        const work = await requireWork(scope.workspaceId, input.workId);
        const docs = await requireClean(scope.workspaceId, input.workId);
        if (!docs.length) throw new WorkError('INVALID_WORK_INPUT');
        const settings = await deps.settings.current(scope.workspaceId);
        if (!settings) throw new WorkError('LLM_NOT_CONFIGURED');
        if (await deps.processing.active(scope.workspaceId, input.workId))
          throw new WorkError('WORK_BUSY');
        await deps.transaction(async ({ works, processing }) => {
          await processing.start({
            id: crypto.randomUUID(),
            workspaceId: scope.workspaceId,
            workId: input.workId,
            kind: 'analysis',
            inputRevision: work.inputRevision,
            documentIds: docs.map((doc) => doc.id),
            settingsRevision: settings.revision,
            generationId: null,
            correlationId: input.correlationId,
            attemptToken: null,
            actorId: scope.userId,
            modelSnapshot: {
              vision: settings.visionModel,
              extraction: settings.extractionModel,
            },
          });
          await works.event(
            scope.workspaceId,
            input.workId,
            'processing.queued',
          );
        });
      });
    },
    async edit(scope, input) {
      scope.require('works.edit');
      await locked(scope.workspaceId, input.workId, async () => {
        const work = await requireWork(scope.workspaceId, input.workId);
        await requireClean(scope.workspaceId, input.workId);
        if (work.revision !== input.revision)
          throw new WorkError('REVISION_CONFLICT');
        await deps.transaction(async ({ works, facts }) => {
          await facts.save(
            scope.workspaceId,
            input.workId,
            editFacts(
              await facts.get(scope.workspaceId, input.workId),
              input.values,
            ),
          );
          await works.touch(scope.workspaceId, input.workId, {});
          await works.event(scope.workspaceId, input.workId, 'facts.changed');
        });
      });
      return get(scope, input.workId);
    },
    async confirm(scope, input) {
      scope.require('works.edit');
      await locked(scope.workspaceId, input.workId, async () => {
        const work = await requireWork(scope.workspaceId, input.workId);
        await requireClean(scope.workspaceId, input.workId);
        if (work.revision !== input.revision)
          throw new WorkError('REVISION_CONFLICT');
        if (await deps.processing.active(scope.workspaceId, input.workId))
          throw new WorkError('WORK_BUSY');
        await deps.transaction(async ({ works, facts }) => {
          await facts.save(
            scope.workspaceId,
            input.workId,
            confirmFacts(await facts.get(scope.workspaceId, input.workId)),
          );
          await works.touch(scope.workspaceId, input.workId, {
            confirmed: true,
          });
          await works.event(scope.workspaceId, input.workId, 'facts.confirmed');
        });
      });
      return get(scope, input.workId);
    },
    async generate(scope, input) {
      scope.require('works.generate');
      await locked(scope.workspaceId, input.workId, async () => {
        const work = await requireWork(scope.workspaceId, input.workId);
        const docs = await requireClean(scope.workspaceId, input.workId);
        if (work.revision !== input.revision)
          throw new WorkError('REVISION_CONFLICT');
        if (await deps.processing.active(scope.workspaceId, input.workId))
          throw new WorkError('WORK_BUSY');
        const values = (await deps.facts.get(scope.workspaceId, input.workId))
          .values;
        const id = crypto.randomUUID();
        await deps.transaction(
          async ({ works, processing, generation, audit }) => {
            await generation.create({
              id,
              workspaceId: scope.workspaceId,
              workId: input.workId,
              revision: work.revision,
              confirmed: work.confirmedRevision === work.revision,
              values,
              packageVersion: work.packageVersion,
              files: requirePackage(work.packageVersion).documents.map(
                (template) => ({
                  id: crypto.randomUUID(),
                  templateVersion: template.version,
                  title: template.title,
                  filename: template.filename,
                }),
              ),
            });
            await processing.start({
              id: crypto.randomUUID(),
              workspaceId: scope.workspaceId,
              workId: input.workId,
              kind: 'generation',
              inputRevision: work.inputRevision,
              documentIds: docs.map((doc) => doc.id),
              settingsRevision: null,
              generationId: id,
              correlationId: input.correlationId,
              attemptToken: null,
              actorId: scope.userId,
              modelSnapshot: { vision: '', extraction: '' },
            });
            await works.event(
              scope.workspaceId,
              input.workId,
              'generation.queued',
            );
            await audit.record({
              workspaceId: scope.workspaceId,
              actorId: scope.userId,
              action: 'generation.started',
              target: { kind: 'generation', id },
              data: { workId: input.workId },
              correlationId: input.correlationId,
            });
          },
        );
      });
    },
    async download(scope, workId, generationId, fileId) {
      scope.require('works.read');
      await requireWork(scope.workspaceId, workId);
      await requireClean(scope.workspaceId, workId);
      const result = await deps.generation.get(
        scope.workspaceId,
        workId,
        generationId,
      );
      if (!result) throw new WorkError('NOT_FOUND');
      const file = fileId
        ? result.files.find((entry) => entry.id === fileId)
        : result.files[0];
      if (!file) throw new WorkError('NOT_FOUND');
      if (file.status !== 'succeeded' || !file.key || !file.checksum)
        throw new WorkError('NOT_READY');
      const bytes = await deps.storage.get(file.key);
      if ((await checksum(bytes)) !== file.checksum)
        throw new Error('INVALID_GENERATED_DOCUMENT');
      await requireClean(scope.workspaceId, workId);
      return {
        bytes,
        filename: `${result.confirmed ? '' : 'draft-'}${file.filename}`,
      };
    },
    async events(scope, workId, after) {
      scope.require('works.read');
      await requireWork(scope.workspaceId, workId);
      if (!/^\d{1,30}$/.test(after)) throw new WorkError('INVALID_WORK_INPUT');
      return deps.works.events(scope.workspaceId, workId, after);
    },
  };
}
