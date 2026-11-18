import type {
  FieldKey,
  FieldValue,
  FieldValues,
} from '@anyko/contracts/catalog';

import {
  allKeys,
  type FactValues,
  sameFieldValue,
  sameFieldValues,
} from './field-value';

interface FactsRevision {
  revision: number;
  cleanupPending: boolean;
  server: FieldValues;
}

interface FactsDraft extends FactsRevision {
  editConflicts: readonly FieldKey[];
}

export interface FactsFormChange {
  resetTo?: FieldValues;
  values?: FieldValues;
}

export interface FactsDraftTransition {
  draft: FactsDraft;
  formChange?: FactsFormChange;
}

export type FactsDraftEvent =
  | { type: 'revision'; snapshot: FactsRevision }
  | { type: 'saved'; snapshot: FactsRevision }
  | { type: 'change'; changes: Partial<FieldValues> }
  | { type: 'keep-edit'; key: FieldKey }
  | { type: 'take-server'; key: FieldKey }
  | { type: 'discard' };

export function startFactsDraft(snapshot: FactsRevision): FactsDraft {
  return { ...snapshot, editConflicts: [] };
}

export function hasFactsDraftEdits(
  draft: FactsDraft,
  values: FieldValues,
): boolean {
  return !draft.cleanupPending && !sameFieldValues(values, draft.server);
}

export function draftForSave(draft: FactsDraft, values: FieldValues) {
  return draft.editConflicts.length
    ? null
    : { revision: draft.revision, values };
}

export function transitionFactsDraft(
  draft: FactsDraft,
  values: FieldValues,
  event: FactsDraftEvent,
): FactsDraftTransition {
  switch (event.type) {
    case 'revision':
      return applyRevision(draft, values, event.snapshot);
    case 'saved':
      return {
        draft: startFactsDraft(event.snapshot),
        formChange: { resetTo: event.snapshot.server },
      };
    case 'change': {
      const next = { ...values };
      for (const [key, value] of Object.entries(event.changes))
        if (value !== undefined) next[key] = value;
      return { draft, formChange: { values: next } };
    }
    case 'keep-edit':
      return { draft: resolveEditConflict(draft, event.key) };
    case 'take-server': {
      const next = Object.hasOwn(draft.server, event.key)
        ? { ...values, [event.key]: draft.server[event.key] ?? null }
        : Object.fromEntries(
            Object.entries(values).filter(([key]) => key !== event.key),
          );
      return {
        draft: resolveEditConflict(draft, event.key),
        formChange: { values: next },
      };
    }
    case 'discard':
      return {
        draft: { ...draft, editConflicts: [] },
        formChange: { resetTo: draft.server },
      };
  }
}

function resolveEditConflict(draft: FactsDraft, key: FieldKey): FactsDraft {
  return {
    ...draft,
    editConflicts: draft.editConflicts.filter((item) => item !== key),
  };
}

function applyRevision(
  draft: FactsDraft,
  values: FieldValues,
  snapshot: FactsRevision,
): FactsDraftTransition {
  if (
    snapshot.revision === draft.revision &&
    snapshot.cleanupPending === draft.cleanupPending
  )
    return { draft };
  const mine = snapshot.cleanupPending ? snapshot.server : values;
  const rebased = rebaseFacts({
    base: draft.server,
    mine,
    theirs: snapshot.server,
  });
  // База уже обновлена в предыдущей редакции, но неразрешённый конфликт правки ещё действует.
  const unresolved = draft.editConflicts.filter(
    (key) => !sameFieldValue(mine[key], snapshot.server[key]),
  );
  const next = { ...snapshot.server, ...rebased.values };
  return {
    draft: {
      ...snapshot,
      editConflicts: [...new Set([...unresolved, ...rebased.editConflicts])],
    },
    formChange: {
      resetTo: snapshot.server,
      ...(!sameFieldValues(next, snapshot.server) && { values: next }),
    },
  };
}

// Перенос правок на новую редакцию сведений: трёхсторонний merge по ключам.
// base — серверные значения, от которых начаты правки; mine — значения формы; theirs — новые серверные значения.
// По каждому ключу объединения трёх сторон:
// - пользователь не менял (mine == base) — берётся theirs;
// - сервер не менял (theirs == base) или обе стороны пришли к одному значению — остаётся mine;
// - изменили обе стороны по-разному — остаётся mine, ключ попадает в список конфликтов правки.
// Отсутствующий ключ с undefined в результат не попадает.
function rebaseFacts({
  base,
  mine,
  theirs,
}: {
  base: FactValues;
  mine: FactValues;
  theirs: FactValues;
}) {
  const values: Record<string, FieldValue> = {};
  const editConflicts: FieldKey[] = [];
  for (const key of allKeys(base, mine, theirs)) {
    const original = base[key];
    const ours = mine[key];
    const server = theirs[key];
    let resolved: FieldValue | undefined;
    if (sameFieldValue(ours, original)) resolved = server;
    else if (sameFieldValue(server, original) || sameFieldValue(ours, server))
      resolved = ours;
    else {
      resolved = ours;
      editConflicts.push(key);
    }
    if (resolved !== undefined) values[key] = resolved;
  }
  return { values, editConflicts };
}
