import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertNoLocalAuthHeaders,
  commandEnvironment,
} from '../../scripts/agent-github.mjs';

// Exercise Git's real URL matcher: a public ls-remote can pass without authentication.
for (const suffix of ['', '.git']) {
  test(`Git receives App authorization for Anyko${suffix}`, () => {
    const result = spawnSync(
      'git',
      [
        'config',
        '--get-urlmatch',
        'http.extraHeader',
        `https://github.com/kindyakov/anyko${suffix}`,
      ],
      {
        env: commandEnvironment(
          'synthetic-test-token',
          'unused-config-directory',
        ),
        encoding: 'utf8',
        timeout: 10000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      `Authorization: Basic ${Buffer.from('x-access-token:synthetic-test-token').toString('base64')}`,
    );
  });
}

for (const url of [
  'https://github.com/kindyakov/anyko_client.git',
  'https://github.com/kindyakov/besteach.git',
  'https://example.com/kindyakov/anyko.git',
]) {
  test(`App authorization is not selected for ${url}`, () => {
    const result = spawnSync(
      'git',
      ['config', '--get-urlmatch', 'http.extraHeader', url],
      {
        env: commandEnvironment(
          'synthetic-test-token',
          'unused-config-directory',
        ),
        encoding: 'utf8',
        timeout: 10000,
      },
    );
    expect(result.error).toBeUndefined();
    expect([0, 1]).toContain(result.status);
    expect(result.stdout.trim()).toBe('');
  });
}

test('clears a checkout credential before selecting the app header', () => {
  const dir = mkdtempSync(join(tmpdir(), 'anyko-git-test-'));
  try {
    expect(spawnSync('git', ['init', '-q', dir]).status).toBe(0);
    expect(() => assertNoLocalAuthHeaders(dir)).not.toThrow();
    for (const key of [
      'http.extraheader',
      'http.https://github.com/kindyakov/anyko.git.extraheader',
    ]) {
      expect(
        spawnSync('git', ['-C', dir, 'config', key, 'inherited-test-header'])
          .status,
      ).toBe(0);
      expect(() => assertNoLocalAuthHeaders(dir)).toThrow(
        'Local Git extraHeader detected',
      );
      expect(
        spawnSync('git', ['-C', dir, 'config', '--unset', key]).status,
      ).toBe(0);
    }
    expect(
      spawnSync('git', [
        '-C',
        dir,
        'config',
        'http.https://github.com/.extraheader',
        'inherited-test-header',
      ]).status,
    ).toBe(0);
    const result = spawnSync(
      'git',
      [
        '-C',
        dir,
        'config',
        '--get-urlmatch',
        'http.extraHeader',
        'https://github.com/kindyakov/other.git',
      ],
      {
        env: commandEnvironment(
          'synthetic-test-token',
          'unused-config-directory',
        ),
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
