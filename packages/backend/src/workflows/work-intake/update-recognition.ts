import type { DocumentResultView } from '../../modules/documents';
import { type FactEvidence } from '../../modules/facts';
import { WorkError } from '../../modules/works';
import type { DocumentId, WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import { changeWork } from '../change-work';
import { workCommandPolicy } from '../work-command-guards';
import { requireWorkDocument } from '../work-view/require-work-document';

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
    scope.require(workCommandPolicy.updateRecognition.right);
    const { workspaceId } = scope;
    await changeWork(
      deps,
      scope,
      {
        workId,
        command: 'updateRecognition',
        event: 'documents.changed',
        sourceChange: true,
      },
      async ({ work }) => {
        const source = await requireWorkDocument(
          deps.works.queries,
          scope,
          workId,
          documentId,
        );
        if (source.revision === null) throw new WorkError('NOT_READY');
        if (source.revision >= ocrRevision) return;
        const [previous, next] = await Promise.all([
          deps.documents.internal.queries.result(source),
          deps.documents.internal.queries.result({
            workspaceId,
            documentId,
            revision: ocrRevision,
          }),
        ]);
        return async (tx, lockRevision) => {
          const [live] = await deps.lockDocumentRevisions(tx, workspaceId, [
            documentId,
          ]);
          if (!live) throw new WorkError('NOT_FOUND');
          if (live.revision === null || live.revision < ocrRevision)
            throw new WorkError('NOT_READY');
          await lockRevision();
          if (
            !(await deps.works
              .in(tx)
              .internal.updateRecognition(
                workspaceId,
                workId,
                documentId,
                ocrRevision,
              ))
          )
            throw new WorkError('NOT_FOUND');
          const refreshed = await deps.facts
            .in(tx)
            .internal.refreshEvidence(
              workspaceId,
              workId,
              recognitionEvidence(documentId, previous, next),
            );
          return {
            confirmed:
              work.confirmedRevision === work.revision &&
              !refreshed.needsReview?.length,
          };
        };
      },
    );
  };
