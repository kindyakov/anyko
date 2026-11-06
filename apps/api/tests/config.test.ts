import { expect, test } from 'bun:test';

import { parseApiConfig } from '../src/bootstrap/config';
test('rejects invalid env without including values', () => {
  expect(() => parseApiConfig({ API_PORT: 'private-fixture' })).toThrow(
    'API_PORT',
  );
  try {
    parseApiConfig({ API_PORT: 'private-fixture' });
  } catch (error) {
    expect(String(error)).not.toContain('private-fixture');
  }
  expect(parseApiConfig({ API_PORT: '3200' }).API_PORT).toBe(3200);
  expect(() => parseApiConfig({ API_PORT: '' })).toThrow();
});
