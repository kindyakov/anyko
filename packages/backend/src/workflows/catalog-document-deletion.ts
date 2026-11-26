import {
  type DocumentDeletionConfirmation,
  DocumentError,
} from '../modules/documents';
import type { FactsPorts } from '../modules/facts';
import type { WorkStore } from '../modules/works';
import { sha256Hex } from '../platform/digest';

import { finishSourceChange } from './change-work';
import { workLockKey } from './work-guards';
import type { ResolveWorkPackage } from './work-package';

type AffectedWork = {
  id: string;
  title: string;
  revision: number;
  confirmedRevision: number | null;
  packageVersion: string;
  busy: boolean;
};

interface ImpactPorts {
  exists(workspaceId: string, documentId: string): Promise<boolean>;
  affectedWorks(
    workspaceId: string,
    documentId: string,
  ): Promise<AffectedWork[]>;
}

interface DeletionPorts extends ImpactPorts {
  resolvePackage: ResolveWorkPackage;
  lockSource(workspaceId: string, documentId: string): Promise<boolean>;
  isDeleted(workspaceId: string, documentId: string): Promise<boolean>;
  tryWorkLock(key: string): Promise<boolean>;
  unlink(
    workspaceId: string,
    documentId: string,
    workIds: string[],
  ): Promise<void>;
  eraseSteps(
    workspaceId: string,
    documentId: string,
    workIds: string[],
  ): Promise<void>;
  facts: Pick<
    FactsPorts['internal'],
    'refreshEvidence' | 'removeSubmittedAttachment'
  >;
  works: Pick<WorkStore, 'touch' | 'event' | 'lockRevision'>;
  eraseSession(workspaceId: string, workId: string): Promise<void>;
  threads(workspaceId: string, workId: string): Promise<string[]>;
  markDeleted(
    workspaceId: string,
    documentId: string,
    threadIds: string[],
  ): Promise<boolean>;
  cancelDocument(workspaceId: string, documentId: string): Promise<void>;
  redactResponses(workspaceId: string, documentId: string): Promise<unknown>;
  recordDeletion(
    workspaceId: string,
    documentId: string,
    actorId: string,
  ): Promise<unknown>;
}

function impactToken(documentId: string, works: AffectedWork[]) {
  return sha256Hex(
    new TextEncoder().encode(
      JSON.stringify([documentId, works.map(({ id, title }) => [id, title])]),
    ),
  );
}

export async function readDeletionImpact(
  ports: ImpactPorts,
  workspaceId: string,
  documentId: string,
) {
  if (!(await ports.exists(workspaceId, documentId))) return null;
  const works = await ports.affectedWorks(workspaceId, documentId);
  return {
    token: await impactToken(documentId, works),
    works: works.map(({ id, title, busy }) => ({ id, title, busy })),
  };
}

export async function deleteCatalogDocument(
  ports: DeletionPorts,
  workspaceId: string,
  documentId: string,
  actorId: string,
  confirmation?: DocumentDeletionConfirmation,
) {
  // OCR publication and new attachments use the same source row lock.
  if (!(await ports.lockSource(workspaceId, documentId)))
    return ports.isDeleted(workspaceId, documentId);
  const initial = await ports.affectedWorks(workspaceId, documentId);
  if (initial.length && !confirmation?.canDeleteLinked)
    throw new DocumentError('FORBIDDEN');
  if (initial.length && !confirmation?.token)
    throw new DocumentError('DOCUMENT_IN_USE');
  // Attachments acquire the work lock before the source lock, so never wait here.
  for (const { id } of initial) {
    if (!(await ports.tryWorkLock(workLockKey(workspaceId, id))))
      throw new DocumentError('WORK_BUSY');
  }
  const works = await ports.affectedWorks(workspaceId, documentId);
  if (
    confirmation?.token &&
    confirmation.token !== (await impactToken(documentId, works))
  )
    throw new DocumentError('REVISION_CONFLICT');
  if (works.some(({ busy }) => busy)) throw new DocumentError('WORK_BUSY');
  // OCR claims and completions take the Run lock before notifying linked works.
  await ports.cancelDocument(workspaceId, documentId);
  const workIds = works.map(({ id }) => id);
  const threadIds: string[] = [];
  if (workIds.length) {
    for (const { id, revision } of works)
      await ports.works.lockRevision(workspaceId, id, revision);
    await ports.unlink(workspaceId, documentId, workIds);
    await ports.eraseSteps(workspaceId, documentId, workIds);
    for (const { id, revision, confirmedRevision, packageVersion } of works) {
      const {
        description: { fields },
      } = ports.resolvePackage(packageVersion);
      const updated = await ports.facts.refreshEvidence(
        workspaceId,
        id,
        (entry) => (entry.documentId === documentId ? null : entry),
        fields,
      );
      await ports.facts.removeSubmittedAttachment(
        workspaceId,
        id,
        documentId,
        fields,
      );
      await ports.eraseSession(workspaceId, id);
      threadIds.push(...(await ports.threads(workspaceId, id)));
      await finishSourceChange(
        ports.works,
        workspaceId,
        id,
        revision,
        'documents.changed',
        {
          confirmed:
            confirmedRevision === revision && !updated.needsReview?.length,
        },
      );
    }
  }
  await ports.markDeleted(workspaceId, documentId, threadIds);
  await ports.redactResponses(workspaceId, documentId);
  await ports.recordDeletion(workspaceId, documentId, actorId);
  return true;
}
