import { ApiError } from '@/lib/api/errors';

// The server returns indexes into the submitted set. Keep the rest of the selection.
export function unavailableCatalogFiles(
  error: unknown,
  ids: string[],
  selected: ReadonlyMap<string, string>,
) {
  const unavailable =
    error instanceof ApiError && error.code === 'NOT_READY'
      ? (error.fields?.flatMap(({ path }) => {
          const id =
            path[0] === 'documentIds' && typeof path[1] === 'number'
              ? ids[path[1]]
              : undefined;
          return id ? [id] : [];
        }) ?? [])
      : [];
  if (!unavailable.length) return;
  const remaining = new Map(selected);
  for (const id of unavailable) remaining.delete(id);
  return {
    remaining,
    message: `Файлы стали недоступны: ${unavailable.map((id) => selected.get(id) ?? id).join(', ')}.`,
  };
}
