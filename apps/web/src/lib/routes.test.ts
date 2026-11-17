import { expect, test } from 'bun:test';

import { routes, safeNextPath } from '@/lib/routes';

test('internal paths are kept as they are', () => {
  expect(safeNextPath('/')).toBe('/');
  expect(safeNextPath('/w/ws-1/works?tab=all')).toBe('/w/ws-1/works?tab=all');
  expect(safeNextPath('/works/1/x%2Fy')).toBe('/works/1/x%2Fy');
});

test('open redirects fall back to the home path', () => {
  const attempts = [
    '//evil.example',
    '//evil.example/path',
    '/\\\\evil.example',
    '/\\/evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    'https://evil.example',
    'http://evil.example/w',
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' //evil.example',
    'evil.example',
    '',
    `/${'a'.repeat(3000)}`,
    undefined,
    null,
    42,
    ['/works', '/documents'],
  ];
  for (const attempt of attempts) expect(safeNextPath(attempt)).toBe('/');
});

test('sign-in address encodes the return path as one parameter', () => {
  expect(routes.signIn()).toBe('/sign-in');
  expect(routes.signIn('/w/ws/works?x=a&b=c')).toBe(
    '/sign-in?next=%2Fw%2Fws%2Fworks%3Fx%3Da%26b%3Dc',
  );
});

test('the screen for users without workspaces has its own address', () => {
  expect(routes.noWorkspace()).toBe('/no-workspace');
});

test('workspace routes sit under /w/[workspace]', () => {
  expect(routes.works('ws-1')).toBe('/w/ws-1/works');
  expect(routes.work('ws-1', 'work-2')).toBe('/w/ws-1/works/work-2');
  expect(routes.recognition('ws-1')).toBe('/w/ws-1/recognition');
  expect(routes.connections('ws-1')).toBe('/w/ws-1/settings/connections');
  expect(routes.works('a/b')).toBe('/w/a%2Fb/works');
});
