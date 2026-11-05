import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { commandEnvironment } from '../../scripts/agent-github.mjs';

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
      'Authorization: Basic eC1hY2Nlc3MtdG9rZW46c3ludGhldGljLXRlc3QtdG9rZW4=',
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
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
  });
}
