import type { DocumentResultView } from '../../modules/documents';
import { type FactEvidence, refreshFactEvidence } from '../../modules/facts';
import { WorkError } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import {
  requireCleanSources,
  requireIdle,
  requireWork,
  workLockKey,
} from '../work-guards';

import type { WorkIntakeDeps } from './deps';

const normalizeQuote = (text: string) =>
  text.normalize('NFKC').replace(/\s+/gu, ' ').trim();

function quotePattern(quote: string) {
  const literal = quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = /^\p{N}/u.test(quote)
    ? '(?<![\\p{L}\\p{N}+−-]|\\p{N}[.,:/ -])'
    : /^\p{L}/u.test(quote)
      ? '(?<![\\p{L}\\p{N}]|[\\p{L}\\p{N}]-)'
      : '';
  const end = /\p{N}$/u.test(quote)
    ? '(?![\\p{L}\\p{N}]|[.,:/ -]\\p{N})'
    : /\p{L}$/u.test(quote)
      ? '(?![\\p{L}\\p{N}]|-[\\p{L}\\p{N}])'
      : /\p{N}[.,]$/u.test(quote)
        ? '(?!\\p{N})'
        : '';
  return new RegExp(start + literal + end, 'u');
}

function recognitionEvidence(
  documentId: string,
  previous: DocumentResultView,
  next: DocumentResultView,
) {
  const text = normalizeQuote(next.markdown);
  const pages =
    next.pdfOcr?.pages.map(({ page, lines }) => ({
      page,
      text: normalizeQuote(lines.map(({ text }) => text).join(' ')),
    })) ?? [];
  return (entry: FactEvidence): FactEvidence | null => {
    if (entry.documentId !== documentId) return entry;
    if (entry.imagePath !== null) {
      const checksum = previous.images.find(
        ({ path }) => entry.imagePath === path,
      )?.checksum;
      if (!checksum) return null;
      const matches = next.images.filter(
        (image) => image.checksum === checksum,
      );
      const match =
        matches.find(({ path }) => path === entry.imagePath) ??
        (matches.length === 1 ? matches[0] : undefined);
      return match
        ? { documentId, imagePath: match.path, quote: entry.quote }
        : null;
    }
    const quote = normalizeQuote(entry.quote);
    if (!quote) return null;
    const pattern = quotePattern(quote);
    if (!pattern.test(text)) return null;
    const matches = pages.filter((item) => pattern.test(item.text));
    return {
      documentId,
      imagePath: null,
      quote: entry.quote,
      ...(matches.length === 1 && matches[0] && { page: matches[0].page }),
    };
  };
}

export const updateRecognition =
  (
    deps: Pick<
      WorkIntakeDeps,
      | 'works'
      | 'facts'
      | 'documents'
      | 'processing'
      | 'uow'
      | 'locks'
      | 'lockDocumentRevisions'
    >,
  ) =>
  async (
    scope: WorkspaceScope,
    {
      workId,
      documentId,
      ocrRevision,
    }: {
      workId: WorkId;
      documentId: DocumentId;
      ocrRevision: number;
    },
  ) => {
    scope.require('works.edit');
    const { workspaceId } = scope;
    await deps.locks.run(workLockKey(workspaceId, workId), async () => {
      const works = deps.works.queries;
      const work = await requireWork(works, scope, workId);
      const source = (await requireCleanSources(works, scope, workId)).find(
        ({ id }) => id === documentId,
      );
      if (!source) throw new WorkError('NOT_FOUND');
      if (source.ocrRevision === null) throw new WorkError('NOT_READY');
      if (source.ocrRevision >= ocrRevision) return;
      await requireIdle(deps.processing.queries, scope, workId);
      const [previous, next, facts] = await Promise.all([
        deps.documents.internal.queries.result({
          workspaceId,
          documentId,
          revision: source.ocrRevision,
        }),
        deps.documents.internal.queries.result({
          workspaceId,
          documentId,
          revision: ocrRevision,
        }),
        deps.facts.internal.get(workspaceId, workId),
      ]);
      const refreshed = refreshFactEvidence(
        facts,
        recognitionEvidence(documentId, previous, next),
      );
      await deps.uow.run(async (tx) => {
        const [live] = await deps.lockDocumentRevisions(tx, workspaceId, [
          documentId,
        ]);
        if (!live) throw new WorkError('NOT_FOUND');
        if (live.revision === null || live.revision < ocrRevision)
          throw new WorkError('NOT_READY');
        const workStore = deps.works.in(tx).internal;
        if (
          !(await workStore.updateRecognition(
            workspaceId,
            workId,
            documentId,
            ocrRevision,
          ))
        )
          throw new WorkError('NOT_FOUND');
        await deps.facts.in(tx).internal.save(workspaceId, workId, refreshed);
        await workStore.touch(workspaceId, workId, {
          inputChanged: true,
          confirmed:
            work.confirmedRevision === work.revision &&
            !refreshed.needsReview?.length,
        });
        await workStore.event(workspaceId, workId, 'documents.changed');
      });
    });
  };
