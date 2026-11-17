// Выбор области для `/`: последняя открытая область, если пользователь в ней участвует, иначе первая
// из участий сессии. Пустой список участий возвращает undefined: вызывающий ведёт на экран «Нет доступа».
export function pickWorkspace(
  memberships: readonly { readonly workspace: { readonly id: string } }[],
  lastWorkspace: string | undefined,
): string | undefined {
  if (
    lastWorkspace !== undefined &&
    memberships.some((membership) => membership.workspace.id === lastWorkspace)
  )
    return lastWorkspace;
  return memberships[0]?.workspace.id;
}
