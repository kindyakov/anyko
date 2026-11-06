import { sign } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const appId = 5620461;
const installationId = 178751173;
const repository = 'kindyakov/anyko';
const permissions = {
  actions: 'read',
  checks: 'read',
  contents: 'write',
  issues: 'write',
  metadata: 'read',
  pull_requests: 'write',
};

async function request(path, token, method = 'GET', body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      'User-Agent': 'anyko-agent-github',
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return response;
}

async function readResponse(response) {
  if (!response.ok)
    throw new Error(`GitHub request failed: HTTP ${response.status}`);
  return response.json();
}

export function assertPermissions(actual) {
  if (
    !actual ||
    Object.keys(actual).length !== Object.keys(permissions).length ||
    Object.entries(permissions).some(([name, level]) => actual[name] !== level)
  ) {
    throw new Error('Unexpected GitHub App permissions; refusing to run.');
  }
}

async function mintToken() {
  const keyPath = process.env.ANYKO_GITHUB_APP_KEY_PATH;
  if (!keyPath)
    throw new Error(
      'Set ANYKO_GITHUB_APP_KEY_PATH to the private key outside the repository.',
    );
  const key = await readFile(keyPath);
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 300, iss: String(appId) })}`;
  const jwt = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`;
  const installation = await readResponse(
    await request(`/app/installations/${installationId}`, jwt),
  );
  if (
    installation.app_id !== appId ||
    installation.account?.login !== 'kindyakov' ||
    installation.repository_selection !== 'selected' ||
    installation.suspended_at !== null
  ) {
    throw new Error('Unexpected or suspended GitHub App installation.');
  }
  assertPermissions(installation.permissions);
  const result = await readResponse(
    await request(
      `/app/installations/${installationId}/access_tokens`,
      jwt,
      'POST',
      {
        repositories: ['anyko'],
        permissions,
      },
    ),
  );
  if (typeof result.token !== 'string' || !result.token)
    throw new Error('GitHub did not return an installation token.');
  return result.token;
}

async function verifyToken(token) {
  const result = await readResponse(
    await request('/installation/repositories', token),
  );
  if (
    result.total_count !== 1 ||
    result.repositories?.length !== 1 ||
    result.repositories[0]?.full_name !== repository
  ) {
    throw new Error('Installation token is not scoped exclusively to Anyko.');
  }
}

export function commandEnvironment(token, configDir) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) =>
        !/^(GH_|GITHUB_|GIT_|SSH_|ANYKO_GITHUB_APP_KEY_PATH$)/i.test(name),
    ),
  );
  return {
    ...env,
    GH_TOKEN: token,
    GH_HOST: 'github.com',
    GH_REPO: repository,
    GH_CONFIG_DIR: configDir,
    GH_PROMPT_DISABLED: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_ALLOW_PROTOCOL: 'https',
    GIT_CONFIG_COUNT: '4',
    GIT_CONFIG_KEY_0: 'credential.helper',
    GIT_CONFIG_VALUE_0: '',
    GIT_CONFIG_KEY_1: 'http.https://github.com/.extraHeader',
    GIT_CONFIG_VALUE_1: '',
    GIT_CONFIG_KEY_2: `http.https://github.com/${repository}.extraHeader`,
    GIT_CONFIG_VALUE_2: `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
    GIT_CONFIG_KEY_3: `http.https://github.com/${repository}.git.extraHeader`,
    GIT_CONFIG_VALUE_3: `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
  };
}

export function assertNoLocalAuthHeaders(cwd = process.cwd()) {
  const result = spawnSync(
    'git',
    [
      'config',
      '--includes',
      '--name-only',
      '--get-regexp',
      '^http\\.(.*\\.)?extraheader$',
    ],
    {
      cwd,
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name)),
        ),
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      },
    },
  );
  if (result.error || ![0, 1].includes(result.status))
    throw new Error('Cannot inspect local Git configuration safely.');
  if (result.status === 0)
    throw new Error(
      'Local Git extraHeader detected; remove it before using the app launcher.',
    );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (
    !['check', 'gh', 'git'].includes(command) ||
    (command === 'gh' && args[0] === 'auth') ||
    (command === 'git' &&
      args.some(
        (arg) =>
          arg === '-C' ||
          arg.startsWith('-C') ||
          arg.startsWith('--git-dir') ||
          arg.startsWith('--work-tree') ||
          arg === '-c' ||
          arg.startsWith('-c'),
      ))
  ) {
    throw new Error(
      'Usage: agent-github.mjs check | gh <args> | git <args>. gh auth is disabled.',
    );
  }
  let token;
  let configDir;
  try {
    if (command === 'git' || command === 'gh') assertNoLocalAuthHeaders();
    token = await mintToken();
    await verifyToken(token);
    if (command === 'check') {
      const admin = await request(
        `/repos/${repository}/actions/permissions`,
        token,
      );
      if (admin.status !== 403)
        throw new Error(
          `Expected Administration denial, received HTTP ${admin.status}.`,
        );
      console.log(
        JSON.stringify({
          appId,
          installationId,
          repository,
          permissions,
          administrationProbe: admin.status,
        }),
      );
      return;
    }
    configDir = await mkdtemp(join(tmpdir(), 'anyko-gh-'));
    const result = spawnSync(command, args, {
      env: commandEnvironment(token, configDir),
      stdio: 'inherit',
      shell: false,
      timeout: 300000,
    });
    if (result.error || result.signal)
      throw new Error(
        'Child command failed to start, timed out, or was terminated.',
      );
    process.exitCode = result.status ?? 1;
  } finally {
    try {
      if (token) {
        const response = await request('/installation/token', token, 'DELETE');
        if (response.status !== 204)
          throw new Error(
            'Could not revoke installation token; it expires within one hour.',
          );
      }
    } finally {
      if (configDir) await rm(configDir, { recursive: true, force: true });
    }
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    // Never print provider bodies, token-bearing request options, or child environment.
    console.error(
      error instanceof Error && !error.cause
        ? error.message
        : 'GitHub App operation failed.',
    );
    process.exitCode = 1;
  }
}
