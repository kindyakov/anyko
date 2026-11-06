import { workResponseSchema } from '@anyko/contracts';

import { checksum } from '../../modules/documents';
import { confirmFacts, editFacts, emptyFacts } from '../../modules/facts';
import { availablePackages, requirePackage } from '../../modules/templates';
import { type WorkApi, WorkError } from '../../modules/works';

import type { WorkDependencies } from './ports';

export function createWorkApi(deps: WorkDependencies): WorkApi {
  const requireWork = async (workspaceId: string, workId: string) => {
    const work = await deps.works.get(workspaceId, workId);
    if (!work) throw new WorkError('NOT_FOUND');
    return work;
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
  const read: WorkApi['get'] = async (workspaceId, workId) => {
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
  const get: WorkApi['get'] = (workspaceId, workId) =>
    deps.locks.run(`work:${workspaceId}:${workId}`, () =>
      read(workspaceId, workId),
    );
  const locked = <T>(
    workspaceId: string,
    workId: string,
    operation: () => Promise<T>,
  ) => deps.locks.run(`work:${workspaceId}:${workId}`, operation);
  return {
    async removeDocument(input) {
      await locked(input.workspaceId, input.workId, async () => {
        await requireWork(input.workspaceId, input.workId);
        const docs = await deps.works.documents(
          input.workspaceId,
          input.workId,
        );
        if (!docs.some((doc) => doc.id === input.documentId))
          throw new WorkError('NOT_FOUND');
        await deps.documents.remove(input);
        await deps.works.event(
          input.workspaceId,
          input.workId,
          'sources.deleting',
        );
      });
    },
    packages: availablePackages,
    async list(workspaceId, after) {
      if (after) await requireWork(workspaceId, after);
      const rows = await deps.works.list(workspaceId, after);
      const works = rows.slice(0, 50);
      return {
        works,
        nextCursor: rows.length > 50 ? (works.at(-1)?.id ?? null) : null,
      };
    },
    get,
    async create(input) {
      try {
        requirePackage(input.packageVersion);
      } catch {
        throw new WorkError('INVALID_WORK_INPUT');
      }
      const id = crypto.randomUUID();
      await deps.transaction(async ({ works, sessions }) => {
        await works.create({ ...input, id });
        await sessions.ensure(input.workspaceId, id);
        await works.event(input.workspaceId, id, 'work.created');
      });
      return get(input.workspaceId, id);
    },
    async upload(input) {
      return locked(input.workspaceId, input.workId, async () => {
        await requireWork(input.workspaceId, input.workId);
        const sources = await requireClean(input.workspaceId, input.workId);
        if (sources.length >= 20) throw new WorkError('INVALID_WORK_INPUT');
        const document = await deps.documents.upload(input);
        await deps.transaction(async ({ works }) => {
          const linked = await works.documents(input.workspaceId, input.workId);
          if (!linked.some((row) => row.id === document.id)) {
            await works.attach(input.workspaceId, input.workId, document.id);
            await works.touch(input.workspaceId, input.workId, {
              inputChanged: true,
            });
            await works.event(
              input.workspaceId,
              input.workId,
              'documents.changed',
            );
          }
        });
        return document;
      });
    },
    async analyze(input) {
      await locked(input.workspaceId, input.workId, async () => {
        const work = await requireWork(input.workspaceId, input.workId);
        const docs = await requireClean(input.workspaceId, input.workId);
        if (!docs.length) throw new WorkError('INVALID_WORK_INPUT');
        const settings = await deps.settings.current(input.workspaceId);
        if (!settings) throw new WorkError('LLM_NOT_CONFIGURED');
        if (await deps.processing.active(input.workspaceId, input.workId))
          throw new WorkError('WORK_BUSY');
        await deps.transaction(async ({ works, processing }) => {
          await processing.start({
            id: crypto.randomUUID(),
            workspaceId: input.workspaceId,
            workId: input.workId,
            kind: 'analysis',
            inputRevision: work.inputRevision,
            documentIds: docs.map((doc) => doc.id),
            settingsRevision: settings.revision,
            generationId: null,
            correlationId: input.correlationId,
            attemptToken: null,
            actorId: input.actorId,
            modelSnapshot: {
              vision: settings.visionModel,
              extraction: settings.extractionModel,
            },
          });
          await works.event(
            input.workspaceId,
            input.workId,
            'processing.queued',
          );
        });
      });
    },
    async edit(input) {
      await locked(input.workspaceId, input.workId, async () => {
        const work = await requireWork(input.workspaceId, input.workId);
        await requireClean(input.workspaceId, input.workId);
        if (work.revision !== input.revision)
          throw new WorkError('REVISION_CONFLICT');
        await deps.transaction(async ({ works, facts }) => {
          await facts.save(
            input.workspaceId,
            input.workId,
            editFacts(
              await facts.get(input.workspaceId, input.workId),
              input.values,
            ),
          );
          await works.touch(input.workspaceId, input.workId, {});
          await works.event(input.workspaceId, input.workId, 'facts.changed');
        });
      });
      return get(input.workspaceId, input.workId);
    },
    async confirm(input) {
      await locked(input.workspaceId, input.workId, async () => {
        const work = await requireWork(input.workspaceId, input.workId);
        await requireClean(input.workspaceId, input.workId);
        if (work.revision !== input.revision)
          throw new WorkError('REVISION_CONFLICT');
        if (await deps.processing.active(input.workspaceId, input.workId))
          throw new WorkError('WORK_BUSY');
        await deps.transaction(async ({ works, facts }) => {
          await facts.save(
            input.workspaceId,
            input.workId,
            confirmFacts(await facts.get(input.workspaceId, input.workId)),
          );
          await works.touch(input.workspaceId, input.workId, {
            confirmed: true,
          });
          await works.event(input.workspaceId, input.workId, 'facts.confirmed');
        });
      });
      return get(input.workspaceId, input.workId);
    },
    async generate(input) {
      await locked(input.workspaceId, input.workId, async () => {
        const work = await requireWork(input.workspaceId, input.workId);
        const docs = await requireClean(input.workspaceId, input.workId);
        if (work.revision !== input.revision)
          throw new WorkError('REVISION_CONFLICT');
        if (await deps.processing.active(input.workspaceId, input.workId))
          throw new WorkError('WORK_BUSY');
        const values = (await deps.facts.get(input.workspaceId, input.workId))
          .values;
        const id = crypto.randomUUID();
        await deps.transaction(async ({ works, processing, generation }) => {
          await generation.create({
            id,
            workspaceId: input.workspaceId,
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
            workspaceId: input.workspaceId,
            workId: input.workId,
            kind: 'generation',
            inputRevision: work.inputRevision,
            documentIds: docs.map((doc) => doc.id),
            settingsRevision: null,
            generationId: id,
            correlationId: input.correlationId,
            attemptToken: null,
            actorId: input.actorId,
            modelSnapshot: { vision: '', extraction: '' },
          });
          await works.event(
            input.workspaceId,
            input.workId,
            'generation.queued',
          );
        });
      });
    },
    async download(workspaceId, workId, generationId, fileId) {
      await requireWork(workspaceId, workId);
      await requireClean(workspaceId, workId);
      const result = await deps.generation.get(
        workspaceId,
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
      await requireClean(workspaceId, workId);
      return {
        bytes,
        filename: `${result.confirmed ? '' : 'draft-'}${file.filename}`,
      };
    },
    async events(workspaceId, workId, after) {
      await requireWork(workspaceId, workId);
      if (!/^\d{1,30}$/.test(after)) throw new WorkError('INVALID_WORK_INPUT');
      return deps.works.events(workspaceId, workId, after);
    },
  };
}
