import type { ConnectionsModule } from '../../modules/connections';
import type { ProcessingModule } from '../../modules/processing';
import type { WorkSources } from '../../modules/works';
import { isAppError } from '../../platform/errors';
import type { WorkId } from '../../platform/ids';
import type { WorkspaceScope } from '../../platform/scope/workspace-scope';
import {
  requireAnalysisInputs,
  requireIdleWork,
  requireRemovalSource,
  requireUploadCapacity,
  workCommandPolicy,
  workCommandSources,
  WorkInputBlock,
} from '../work-command-guards';

type Command = Exclude<keyof typeof workCommandPolicy, 'edit'>;
type UnavailableReason =
  | WorkInputBlock['reason']
  | 'FACTS_NEED_REVIEW'
  | 'CLEANUP_PENDING'
  | 'CONNECTION_REVOKED'
  | 'FORBIDDEN'
  | 'LLM_NOT_CONFIGURED'
  | 'WORK_BUSY';

type Availability =
  { available: true } | { available: false; reason: UnavailableReason };

export async function workAvailability(
  deps: { processing: ProcessingModule; connections: ConnectionsModule },
  scope: WorkspaceScope,
  workId: WorkId,
  sources: WorkSources,
  factsNeedReview: boolean,
): Promise<Record<Command, Availability>> {
  let active: Promise<boolean> | undefined;
  const decide = async (command: Command): Promise<Availability> => {
    const policy = workCommandPolicy[command];
    try {
      scope.require(policy.right);
      if (command === 'attach') scope.require('recognitions.use');
      const documents = workCommandSources(command, sources);
      if (command === 'analyze')
        await requireAnalysisInputs(
          deps.connections,
          scope.workspaceId,
          documents,
        );
      if (command === 'upload' || command === 'attach')
        requireUploadCapacity(documents);
      if (command === 'remove') requireRemovalSource(documents);
      if (policy.idle) {
        active ??= deps.processing.queries.isActive(scope, workId);
        requireIdleWork(await active);
      }
      if (command === 'generate' && factsNeedReview)
        return { available: false, reason: 'FACTS_NEED_REVIEW' };
      return { available: true };
    } catch (error) {
      if (error instanceof WorkInputBlock)
        return { available: false, reason: error.reason };
      if (isAppError(error)) {
        switch (error.code) {
          case 'CLEANUP_PENDING':
          case 'CONNECTION_REVOKED':
          case 'FORBIDDEN':
          case 'LLM_NOT_CONFIGURED':
          case 'WORK_BUSY':
            return { available: false, reason: error.code };
        }
      }
      throw error;
    }
  };
  const [
    analyze,
    generate,
    confirm,
    upload,
    remove,
    attach,
    updateRecognition,
  ] = await Promise.all([
    decide('analyze'),
    decide('generate'),
    decide('confirm'),
    decide('upload'),
    decide('remove'),
    decide('attach'),
    decide('updateRecognition'),
  ]);
  return {
    analyze,
    generate,
    confirm,
    upload,
    remove,
    attach,
    updateRecognition,
  };
}
