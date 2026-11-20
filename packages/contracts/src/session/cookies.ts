// Имена cookie сессии Better Auth: при https браузер хранит её с префиксом __Secure-.
export const sessionCookieNames = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
] as const;
