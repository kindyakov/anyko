// Адреса разделов. Все адреса рабочей области начинаются с /w/[workspace]; feature получает
// идентификатор области из маршрута и строит ссылки здесь.
const segment = (value: string) => encodeURIComponent(value);

export const routes = {
  home: () => '/',
  signIn: (next?: string) =>
    next === undefined
      ? '/sign-in'
      : (`/sign-in?next=${encodeURIComponent(next)}` as const),
  works: (workspace: string) => `/w/${segment(workspace)}/works` as const,
  work: (workspace: string, id: string) =>
    `/w/${segment(workspace)}/works/${segment(id)}` as const,
  recognition: (workspace: string) =>
    `/w/${segment(workspace)}/recognition` as const,
  connections: (workspace: string) =>
    `/w/${segment(workspace)}/settings/connections` as const,
};

const MAX_NEXT_LENGTH = 2048;

// Адрес возврата после входа принимается только внутренний: одна косая черта в начале,
// без схемы, хоста и управляющих символов. Всё остальное (включая `/\` и `//`) отбрасывается.
export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (value.length > MAX_NEXT_LENGTH) return '/';
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\')
  )
    return '/';
  // Браузер удаляет табуляцию и перевод строки из адреса: `/\t/host` стал бы `//host`.
  if (
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 || character === '\\';
    })
  )
    return '/';
  const base = 'https://anyko.invalid';
  const resolved = new URL(value, base);
  if (resolved.origin !== base) return '/';
  return value;
}
