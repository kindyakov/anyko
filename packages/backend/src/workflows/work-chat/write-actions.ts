import { isDeepStrictEqual } from 'node:util';

import type { WorkspaceActorScope } from '../../modules/access';
import {
  checklistWriteTool,
  type DocumentAgents,
  fieldWriteTool,
} from '../../modules/agents';
import type { WorkAttempt } from '../../modules/processing';
import { WorkError } from '../../modules/works';
import { AppError, isAppError } from '../../platform/errors';
import { brandDocumentId, brandWorkId } from '../../platform/ids';
import type { Tx } from '../../platform/transactions';
import type { FieldDefinition } from '../../profiles/bfl/fields';
import type { WorkDependencies } from '../work-dependencies';
import { workLockKey } from '../work-guards';
import { editChecklistLink } from '../work-review/edit-checklist';
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

type ChatInput = Parameters<DocumentAgents['chat']>[0];
type WriteField = ChatInput['writeField'];
type WriteChecklist = NonNullable<ChatInput['checklist']>['write'];
type WriteArgs = Parameters<WriteField | WriteChecklist>[0];

export async function prepareChatWriter(
  deps: WorkDependencies,
  input: {
    attempt: WorkAttempt;
    requireActor: ReturnType<typeof requireChatActor>;
    initialRevision: number;
    sessionId: string;
    interactionId: string;
    fields: readonly FieldDefinition[];
    checklistSources: ReadonlyMap<string, number | null>;
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
  const history = deps.agents.internal.history;
  const [saved, savedChecklist] = await Promise.all([
    history.fieldWrites(ref),
    history.checklistWrites(ref),
  ]);
  saved.sort((a, b) => a.change.revision - b.change.revision);
  const appliedFields = [...new Set(saved.map(({ change }) => change.field))];
  const checklistKey = ({
    requirementKey,
    documentId,
  }: Parameters<WriteChecklist>[0]) => `${requirementKey}:${documentId}`;
  const recoveredChecklist = new Map(
    savedChecklist.map((receipt) => [checklistKey(receipt.args), receipt]),
  );
  const latestRevisions = [
    saved.at(-1)?.change.revision,
    savedChecklist.at(-1)?.change.revision,
  ].filter((item) => item !== undefined);
  let revision = latestRevisions.length
    ? Math.max(...latestRevisions)
    : input.initialRevision;
  const checkChecklist = async (args: Parameters<WriteChecklist>[0]) => {
    const ocrRevision = input.checklistSources.get(args.documentId);
    if (ocrRevision === undefined) return false;
    const [links, documents] = await Promise.all([
      deps.works.internal.checklistLinks(workspaceId, workId),
      deps.works.internal.documents(workspaceId, workId),
    ]);
    return (
      documents.some(
        (row) =>
          !row.deleted &&
          row.id === args.documentId &&
          row.ocrRevision === ocrRevision,
      ) &&
      links.some(
        (link) =>
          link.requirementKey === args.requirementKey &&
          link.documentId === args.documentId &&
          link.ocrRevision === ocrRevision &&
          link.decision === args.decision,
      )
    );
  };
  const lockKey = workLockKey(workspaceId, workId);
  const appliedChecklist = recoveredChecklist.size
    ? await deps.locks.run(lockKey, async () => {
        if ((await assertCurrent()) !== revision) return [];
        const changes = await Promise.all(
          [...recoveredChecklist.values()].map(async ({ args, change }) =>
            (await checkChecklist(args)) ? [change] : [],
          ),
        );
        return changes.flat();
      })
    : [];
  const calls = new Map(saved.map((receipt) => [receipt.toolCallId, receipt]));
  const checklistCalls = new Map(
    savedChecklist.map((receipt) => [receipt.toolCallId, receipt]),
  );
  const recoveredFields = new Map(
    saved.map((receipt) => [receipt.args.field, receipt]),
  );
  let hasApplied = latestRevisions.length > 0;
  const attemptDeps = (signal: AbortSignal): WorkDependencies => ({
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
  const recordChange = (tx: Tx, payload: string, applied: unknown) =>
    deps.agents
      .in(tx)
      .internal.history.record(ref)
      .tool({
        ...interaction,
        input: payload,
        output: JSON.stringify(applied),
        status: 'succeeded',
      });

  function writeField(...[args, toolCallId, signal]: Parameters<WriteField>) {
    return queueWrite(
      fieldWriteTool,
      args,
      toolCallId,
      signal,
      async (scope, currentRevision, payload) => {
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
        const edit = editWorkField(attemptDeps(signal));
        const change = await edit(
          scope,
          { workId: brandWorkId(workId), revision, ...args },
          {
            afterEdit: (tx, applied) => recordChange(tx, payload, applied),
          },
        );
        revision = change.revision;
        const receipt = { toolCallId, args, change };
        calls.set(toolCallId, receipt);
        return change;
      },
    );
  }

  function writeChecklist(
    ...[args, toolCallId, signal]: Parameters<WriteChecklist>
  ) {
    return queueWrite(
      checklistWriteTool,
      args,
      toolCallId,
      signal,
      async (scope, currentRevision, payload) => {
        const ocrRevision = input.checklistSources.get(args.documentId);
        if (ocrRevision === undefined) throw new WorkError('NOT_FOUND');
        const previous = checklistCalls.get(toolCallId);
        if (previous && !isDeepStrictEqual(previous.args, args))
          throw new WorkError('INVALID_WORK_INPUT');
        const recovered =
          recoveredChecklist.get(checklistKey(args)) ?? previous;
        if (recovered) {
          if (
            currentRevision !== revision ||
            !isDeepStrictEqual(recovered.args, args) ||
            !(await deps.locks.run(
              lockKey,
              async (lockSignal) => {
                await requireActor();
                const matches =
                  (await assertCurrent()) === revision &&
                  (await checkChecklist(args));
                lockSignal.throwIfAborted();
                return matches;
              },
              signal,
            ))
          )
            throw new WorkError('REVISION_CONFLICT');
          checklistCalls.set(toolCallId, recovered);
          return recovered.change;
        }
        const change = await editChecklistLink(attemptDeps(signal))(
          scope,
          {
            ...args,
            workId: brandWorkId(workId),
            documentId: brandDocumentId(args.documentId),
            ocrRevision,
            revision,
          },
          (tx, applied) => recordChange(tx, payload, applied),
        );
        checklistCalls.set(toolCallId, { toolCallId, args, change });
        return change;
      },
    );
  }

  // Calls in the same model step may arrive concurrently. Each field edit
  // advances the optimistic revision seen by the next write in this turn.
  const failures: {
    args: WriteArgs;
    errorCode: string;
    cause: unknown;
  }[] = [];
  let pending = Promise.resolve();
  function queueWrite<Change>(
    tool: string,
    args: WriteArgs,
    toolCallId: string,
    signal: AbortSignal,
    apply: (
      scope: Awaited<ReturnType<typeof requireActor>>,
      currentRevision: number,
      payload: string,
    ) => Promise<Change>,
  ) {
    const result = pending.then(async () => {
      const payload = JSON.stringify({ tool, toolCallId, arguments: args });
      const previous = failures.findIndex((item) =>
        isDeepStrictEqual(item.args, args),
      );
      if (previous >= 0) failures.splice(previous, 1);
      try {
        signal.throwIfAborted();
        const currentRevision = await assertCurrent();
        const scope = await requireActor();
        const change = await apply(scope, currentRevision, payload);
        hasApplied = true;
        return change;
      } catch (error) {
        signal.throwIfAborted();
        const errorCode = isAppError(error) ? error.code : 'TOOL_FAILED';
        await history.record(ref).tool({
          ...interaction,
          input: payload,
          output: null,
          status: 'failed',
          errorCode,
        });
        failures.push({ args, errorCode, cause: error });
        return { errorCode };
      }
    });
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  return {
    appliedFields,
    appliedChecklist,
    writeField,
    writeChecklist,
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
