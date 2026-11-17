import { expect, test } from 'bun:test';

import { lastWorkspaceCookie, sessionGate } from '@/lib/session-gate';

const plain = ['better-auth.session_token'];
const secure = ['__Secure-better-auth.session_token'];

test('the cookie name is the agreed one without secrets', () => {
  expect(lastWorkspaceCookie).toBe('anyko-last-workspace');
});

test('a request without any session cookie goes to sign-in with the encoded return path', () => {
  expect(
    sessionGate({
      pathname: '/w/ws-1/works',
      search: '?tab=all&q=a b',
      cookieNames: ['theme'],
      lastWorkspace: undefined,
    }),
  ).toEqual({
    action: 'redirect',
    location: '/sign-in?next=%2Fw%2Fws-1%2Fworks%3Ftab%3Dall%26q%3Da%20b',
  });
  expect(
    sessionGate({
      pathname: '/',
      search: '',
      cookieNames: [],
      lastWorkspace: undefined,
    }),
  ).toEqual({ action: 'redirect', location: '/sign-in?next=%2F' });
});

test('either session cookie name lets the request continue', () => {
  for (const cookieNames of [plain, secure]) {
    expect(
      sessionGate({
        pathname: '/recognition',
        search: '',
        cookieNames,
        lastWorkspace: undefined,
      }),
    ).toEqual({ action: 'continue' });
  }
});

test('the last workspace cookie is set only on workspace paths and only when it changes', () => {
  const onWorkspace = sessionGate({
    pathname: '/w/ws-1/works/work-9',
    search: '',
    cookieNames: plain,
    lastWorkspace: undefined,
  });
  expect(onWorkspace).toEqual({ action: 'continue', lastWorkspace: 'ws-1' });

  expect(
    sessionGate({
      pathname: '/w/ws-1/recognition',
      search: '',
      cookieNames: plain,
      lastWorkspace: 'ws-1',
    }),
  ).toEqual({ action: 'continue' });

  for (const pathname of [
    '/',
    '/sign-in',
    '/works/x',
    '/w',
    '/workspace/ws-1',
  ]) {
    expect(
      sessionGate({
        pathname,
        search: '',
        cookieNames: plain,
        lastWorkspace: undefined,
      }),
    ).toEqual({ action: 'continue' });
  }
});

test('a workspace id with unsafe characters is never written to the cookie', () => {
  for (const pathname of [
    '/w/%3Cscript%3E/works',
    '/w/%E0%A4%A/works',
    `/w/${'x'.repeat(200)}/works`,
  ]) {
    expect(
      sessionGate({
        pathname,
        search: '',
        cookieNames: plain,
        lastWorkspace: undefined,
      }),
    ).toEqual({ action: 'continue' });
  }
});
