import type { ConnectionsModule } from '../modules/connections';
import type { ProcessingModule } from '../modules/processing';
import {
  WorkError,
  type WorkSourceRow,
  type WorkSources,
} from '../modules/works';
import type { Right } from '../platform/scope';

import { cleanWorkSources } from './work-guards';

export const workCommandPolicy = {
  analyze: { right: 'works.edit', idle: true, clean: true },
  chat: { right: 'works.edit', idle: true, clean: true },
  generate: { right: 'works.generate', idle: true, clean: true },
  confirm: { right: 'works.edit', idle: true, clean: true },
  upload: { right: 'documents.upload', idle: false, clean: true },
  remove: { right: 'documents.delete', idle: false, clean: false },
  attach: { right: 'documents.upload', idle: false, clean: true },
  updateRecognition: { right: 'works.edit', idle: true, clean: true },
  edit: { right: 'works.edit', idle: false, clean: true },
} as const satisfies Record<
  string,
  { right: Right; idle: boolean; clean: boolean }
>;

export function workCommandSources(
  command: keyof typeof workCommandPolicy,
  sources: WorkSources,
): WorkSourceRow[] {
  return workCommandPolicy[command].clean
    ? cleanWorkSources(sources)
    : sources.documents;
}

export class WorkInputBlock extends WorkError {
  constructor(
    readonly reason: 'NO_DOCUMENTS' | 'SOURCE_LIMIT_REACHED',
    code: 'INVALID_WORK_INPUT' | 'NOT_FOUND',
  ) {
    super(code);
  }
}

export function requireIdleWork(active: boolean): void {
  if (active) throw new WorkError('WORK_BUSY');
}

export async function selectAnalysisRecovery(
  processing: Pick<ProcessingModule['internal'], 'latestAnalysisRecovery'>,
  workspaceId: string,
  workId: string,
  documents: readonly WorkSourceRow[],
  uploadPending: boolean,
) {
  const recovery = await processing.latestAnalysisRecovery(workspaceId, workId);
  if (
    recovery?.documentIds.length &&
    recovery.documentIds.every((id) =>
      documents.some((doc) => doc.id === id && !doc.deleted),
    )
  )
    return recovery;
  if (uploadPending) throw new WorkError('WORK_BUSY');
  return null;
}

export async function requireAnalysisInputs(
  connections: ConnectionsModule,
  workspaceId: string,
  documents: readonly WorkSourceRow[],
) {
  if (!documents.length)
    throw new WorkInputBlock('NO_DOCUMENTS', 'INVALID_WORK_INPUT');
  const settings = await connections.internal.configuration(workspaceId, true);
  if (!settings) throw new WorkError('LLM_NOT_CONFIGURED');
  return settings;
}

export const workSourceLimit = 20;

export function requireUploadCapacity(
  documents: readonly WorkSourceRow[],
): void {
  if (documents.length >= workSourceLimit)
    throw new WorkInputBlock('SOURCE_LIMIT_REACHED', 'INVALID_WORK_INPUT');
}

export function requireRemovalSource(
  documents: readonly WorkSourceRow[],
  documentId?: string,
): void {
  if (
    !documents.some(
      (document) =>
        !document.deleted &&
        (documentId === undefined || document.id === documentId),
    )
  )
    throw new WorkInputBlock('NO_DOCUMENTS', 'NOT_FOUND');
}
