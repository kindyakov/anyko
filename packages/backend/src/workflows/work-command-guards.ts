import type { ConnectionsModule } from '../modules/connections';
import {
  WorkError,
  type WorkSourceRow,
  type WorkSources,
} from '../modules/works';
import type { Right } from '../platform/scope';

import { cleanWorkSources } from './work-guards';

export const workCommandPolicy = {
  analyze: { right: 'works.edit', idle: true, clean: true },
  generate: { right: 'works.generate', idle: true, clean: true },
  confirm: { right: 'works.edit', idle: true, clean: true },
  upload: { right: 'documents.upload', idle: false, clean: true },
  remove: { right: 'documents.delete', idle: false, clean: false },
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

export function requireUploadCapacity(
  documents: readonly WorkSourceRow[],
): void {
  if (documents.length >= 20)
    throw new WorkInputBlock('SOURCE_LIMIT_REACHED', 'INVALID_WORK_INPUT');
}

export function requireRemovalSource(
  documents: readonly WorkSourceRow[],
  documentId?: string,
): void {
  if (
    !documents.some(
      (document) => documentId === undefined || document.id === documentId,
    )
  )
    throw new WorkInputBlock('NO_DOCUMENTS', 'NOT_FOUND');
}
