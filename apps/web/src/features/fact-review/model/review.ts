import type {
  FieldKey,
  FieldValue,
  FieldValues,
} from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';

export type ReviewFilter = 'all' | 'conflicts' | 'pending';
export type ReviewField = {
  field: WorkView['package']['fields'][number];
  candidates: WorkView['facts']['candidates'];
};

export const same = (a: FieldValue | undefined, b: FieldValue) =>
  JSON.stringify(a ?? null) === JSON.stringify(b);
const filled = (value: FieldValue | undefined) =>
  Array.isArray(value) ? value.length > 0 : !!value;

export function reviewFields(
  view: WorkView,
  values: FieldValues,
  conflicts: Set<string>,
  filter: ReviewFilter,
) {
  const fields = view.package.fields
    .map((field) => ({
      field,
      candidates: view.facts.candidates.filter(
        (candidate) => candidate.field === field.key,
      ),
    }))
    .filter((item) => item.candidates.length);
  const applied = (key: FieldKey) =>
    fields
      .find((item) => item.field.key === key)
      ?.candidates.some((candidate) => same(values[key], candidate.value)) ??
    false;
  const visible = fields.filter(({ field }) =>
    filter === 'conflicts'
      ? conflicts.has(field.key)
      : filter === 'pending'
        ? !applied(field.key)
        : true,
  );
  const quick = fields.filter(
    ({ field, candidates }) =>
      !conflicts.has(field.key) &&
      !filled(values[field.key]) &&
      candidates[0] !== undefined,
  );
  const total = view.package.fields.length;
  const complete = view.package.fields.filter((field) =>
    filled(values[field.key]),
  ).length;
  return { fields, applied, visible, quick, total, complete };
}
