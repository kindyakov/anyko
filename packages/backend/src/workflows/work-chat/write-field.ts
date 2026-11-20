import { isDeepStrictEqual } from 'node:util';

import type { WorkspaceActorScope } from '../../modules/access';
import { type DocumentAgents, fieldWriteTool } from '../../modules/agents';
import type { WorkAttempt } from '../../modules/processing';
import { WorkError } from '../../modules/works';
import { AppError, isAppError } from '../../platform/errors';
import { brandWorkId } from '../../platform/ids';
import type { Tx } from '../../platform/transactions';
import type { FieldDefinition } from '../../profiles/bfl/fields';
import type { WorkDependencies } from '../work-dependencies';
import { editWorkField } from '../work-review/edit-values';

export function requireChatActor(
  actorScope: WorkspaceActorScope,
  workspaceId: string,
  userId: string,
) {
  return async (tx?: Tx) => {
    const scope = await actorScope(workspaceId, userId, tx);
    if (!scope) throw new AppError('FORBIDDEN', 'forbidden');
    scope.require('works.edit');
    return scope;
  };
}

export async function prepareChatFieldWriter(
  deps: WorkDependencies,
  input: {
    attempt: WorkAttempt;
    requireActor: ReturnType<typeof requireChatActor>;
    initialRevision: number;
    sessionId: string;
    interactionId: string;
    fields: readonly FieldDefinition[];
    assertCurrent: () => Promise<number>;
  },
) {
  const { attempt, requireActor, fields, assertCurrent } = input;
  const { workspaceId, workId, id: runId } = attempt.run;
  const ref = { workspaceId, workId, runId, sessionId: input.sessionId };
  const interaction = {
    interactionId: input.interactionId,
    stage: 'chat' as const,
  };
  const saved = (await deps.agents.internal.history.fieldWrites(ref)).sort(
    (a, b) => a.change.revision - b.change.revision,
  );
  const appliedFields = [...new Set(saved.map(({ change }) => change.field))];
  let revision = saved.at(-1)?.change.revision ?? input.initialRevision;
  const calls = new Map(saved.map((receipt) => [receipt.toolCallId, receipt]));
  const recoveredFields = new Map(
    saved.map((receipt) => [receipt.args.field, receipt]),
  );
  let hasApplied = saved.length > 0;

  type WriteField = Parameters<DocumentAgents['chat']>[0]['writeField'];
  const write = async (
    ...[args, toolCallId, signal]: Parameters<WriteField>
  ) => {
    const payload = JSON.stringify({
      tool: fieldWriteTool,
      toolCallId,
      arguments: args,
    });
    try {
      signal.throwIfAborted();
      const currentRevision = await assertCurrent();
      const scope = await requireActor();
      if (!fields.some(({ key }) => key === args.field))
        throw new WorkError('INVALID_WORK_INPUT');
      const previous = calls.get(toolCallId);
      if (previous && !isDeepStrictEqual(previous.args, args))
        throw new WorkError('INVALID_WORK_INPUT');
      // A resumed provider can replay with new IDs. The final committed
      // value for each field stays authoritative for this turn.
      const recovered = recoveredFields.get(args.field);
      if (recovered) {
        if (
          currentRevision !== revision ||
          !isDeepStrictEqual(recovered.args, args)
        )
          throw new WorkError('REVISION_CONFLICT');
        calls.set(toolCallId, recovered);
        return recovered.change;
      }
      if (previous) return previous.change;
      const edit = editWorkField({
        ...deps,
        uow: {
          run: (apply, lockSignal) =>
            attempt.write(
              async (tx) => {
                await requireActor(tx);
                return apply(tx);
              },
              lockSignal ? AbortSignal.any([signal, lockSignal]) : signal,
            ),
        },
      });
      const change = await edit(
        scope,
        { workId: brandWorkId(workId), revision, ...args },
        {
          async afterEdit(tx, applied) {
            await deps.agents
              .in(tx)
              .internal.history.record(ref)
              .tool({
                ...interaction,
                input: payload,
                output: JSON.stringify(applied),
                status: 'succeeded',
              });
          },
        },
      );
      revision = change.revision;
      hasApplied = true;
      const receipt = { toolCallId, args, change };
      calls.set(toolCallId, receipt);
      return change;
    } catch (error) {
      signal.throwIfAborted();
      const errorCode = isAppError(error) ? error.code : 'TOOL_FAILED';
      await deps.agents.internal.history.record(ref).tool({
        ...interaction,
        input: payload,
        output: null,
        status: 'failed',
        errorCode,
      });
      return { errorCode, cause: error };
    }
  };

  // Calls in the same model step may arrive concurrently. Each accepted edit
  // advances the optimistic revision seen by the next write in this turn.
  const failures: {
    args: Parameters<WriteField>[0];
    errorCode: string;
    cause: unknown;
  }[] = [];
  let pending = Promise.resolve();
  const writeField: WriteField = (args, toolCallId, signal) => {
    const result = pending.then(async () => {
      const outcome = await write(args, toolCallId, signal);
      const previous = failures.findIndex((failure) =>
        isDeepStrictEqual(failure.args, args),
      );
      if (previous >= 0) failures.splice(previous, 1);
      if ('errorCode' in outcome) {
        failures.push({
          args,
          errorCode: outcome.errorCode,
          cause: outcome.cause,
        });
        return { errorCode: outcome.errorCode };
      }
      return outcome;
    });
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  return {
    appliedFields,
    writeField,
    failure(modelError?: { errorCode: string; cause: unknown }) {
      const primary = (hasApplied ? modelError : undefined) ?? failures[0];
      return primary
        ? {
            cause: primary.cause,
            outcome: {
              status: hasApplied ? ('partial' as const) : ('failed' as const),
              errorCode: primary.errorCode,
            },
          }
        : null;
    },
  };
}
