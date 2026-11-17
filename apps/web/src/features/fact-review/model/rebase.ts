import type { FieldValue } from '@anyko/contracts/catalog';

import { allKeys, type FactValues, sameFieldValue } from './field-value';

type FactConflict = { key: string; theirs: FieldValue | undefined };
export type RebaseResult = {
  values: Record<string, FieldValue>;
  conflicts: FactConflict[];
};

// Перенос правок на новую редакцию сведений: трёхсторонний merge по ключам.
// base — серверные значения, от которых начаты правки; mine — значения формы; theirs — новые серверные значения.
// По каждому ключу объединения трёх сторон:
// - пользователь не менял (mine == base) — берётся theirs;
// - сервер не менял (theirs == base) или обе стороны пришли к одному значению — остаётся mine;
// - изменили обе стороны по-разному — остаётся mine, ключ попадает в conflicts вместе с серверным значением.
// Отсутствующий ключ с undefined в результат не попадает.
export function rebaseFacts({
  base,
  mine,
  theirs,
}: {
  base: FactValues;
  mine: FactValues;
  theirs: FactValues;
}): RebaseResult {
  const values: Record<string, FieldValue> = {};
  const conflicts: FactConflict[] = [];
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
      conflicts.push({ key, theirs: server });
    }
    if (resolved !== undefined) values[key] = resolved;
  }
  return { values, conflicts };
}
