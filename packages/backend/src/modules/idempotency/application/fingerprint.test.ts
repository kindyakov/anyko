import { expect, test } from 'bun:test';

import { fingerprintInput } from './fingerprint';

const file = (name: string, text: string) =>
  new File([new TextEncoder().encode(text)], name, { type: 'text/plain' });

test('the fingerprint ignores the order of object keys', async () => {
  const left = await fingerprintInput({
    params: { workspaceId: 'local', workId: 'a' },
    body: { title: 'Synthetic', packageVersion: 'v1' },
  });
  const right = await fingerprintInput({
    body: { packageVersion: 'v1', title: 'Synthetic' },
    params: { workId: 'a', workspaceId: 'local' },
  });
  expect(left).toBe(right);
});

test('a changed value, query or params change the fingerprint', async () => {
  const base = await fingerprintInput({
    params: { workspaceId: 'local' },
    query: { after: 'a' },
    body: { title: 'One' },
  });
  for (const changed of [
    {
      params: { workspaceId: 'other' },
      query: { after: 'a' },
      body: { title: 'One' },
    },
    {
      params: { workspaceId: 'local' },
      query: { after: 'b' },
      body: { title: 'One' },
    },
    {
      params: { workspaceId: 'local' },
      query: { after: 'a' },
      body: { title: 'Two' },
    },
  ])
    expect(await fingerprintInput(changed)).not.toBe(base);
});

test('a multipart file enters the fingerprint by its name and content, not by reference', async () => {
  const same = await fingerprintInput({
    body: { file: file('a.docx', 'alpha') },
  });
  expect(
    await fingerprintInput({ body: { file: file('a.docx', 'alpha') } }),
  ).toBe(same);
  expect(
    await fingerprintInput({ body: { file: file('a.docx', 'beta') } }),
  ).not.toBe(same);
  expect(
    await fingerprintInput({ body: { file: file('b.docx', 'alpha') } }),
  ).not.toBe(same);
});
