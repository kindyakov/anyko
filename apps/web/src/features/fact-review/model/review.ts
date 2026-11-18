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

const filled = (value: FieldValue | undefined) =>
  Array.isArray(value) ? value.length > 0 : !!value;

export function reviewFields(
  view: WorkView,
  values: FieldValues,
  filter: ReviewFilter,
) {
  const conflicts = new Set(view.facts.discrepancyFields);
  const fields = view.package.fields
    .map((field) => ({
      field,
      candidates: view.facts.candidates.filter(
        (candidate) => candidate.field === field.key,
      ),
    }))
    .filter((item) => item.candidates.length);
  const appliedFields = new Set(
    view.facts.candidates
      .filter(({ selected }) => selected)
      .map(({ field }) => field),
  );
  const applied = (key: FieldKey) => appliedFields.has(key);
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
      !applied(field.key) &&
      !filled(values[field.key]) &&
      candidates[0] !== undefined,
  );
  const total = view.package.fields.length;
  const complete = view.package.fields.filter((field) =>
    filled(values[field.key]),
  ).length;
  return { fields, applied, visible, quick, total, complete, conflicts };
}
