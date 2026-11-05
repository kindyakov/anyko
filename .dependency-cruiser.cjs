// Add an explicit edge here only after review. Values name modules whose public
// index may be imported by the owning module.
const moduleEdges = {
  access: [],
  cases: [],
  documents: [],
  processing: [],
  facts: [],
  templates: [],
  generation: [],
};
const knownModules = Object.keys(moduleEdges).join('|');
const { existsSync, readdirSync } = require('node:fs');
const moduleRoot = 'packages/backend/src/modules';
const presentModules = existsSync(moduleRoot)
  ? readdirSync(moduleRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

module.exports = {
  forbidden: [
    {
      name: 'workspace-imports-must-resolve',
      severity: 'error',
      from: {},
      to: { path: '^@anyko/', couldNotResolve: true },
    },
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
    ...Object.entries(moduleEdges).map(([owner, allowed]) => ({
      name: `module-allowlist-${owner}`,
      severity: 'error',
      from: { path: `^packages/backend/src/modules/${owner}/` },
      to: {
        path: '^packages/backend/src/modules/',
        pathNot: `^packages/backend/src/modules/(?:${owner}/|(?:${allowed.length ? allowed.join('|') : '(?!)'})/index\\.[cm]?[jt]s$)`,
      },
    })),
    {
      name: 'unknown-module-no-cross-imports',
      severity: 'error',
      from: {
        path: '^packages/backend/src/modules/([^/]+)/',
        pathNot: `^packages/backend/src/modules/(?:${knownModules})/`,
      },
      to: {
        path: '^packages/backend/src/modules/',
        pathNot: '^packages/backend/src/modules/$1/',
      },
    },
    ...presentModules.map((owner) => ({
      name: `module-private-import-${owner}`,
      severity: 'error',
      from: {
        pathNot: `^packages/backend/(?:src/(?:modules/${owner}/|runtime/)|tests/integration/[^/]+\\.test\\.ts$)`,
      },
      to: {
        path: `^packages/backend/src/modules/${owner}/(?!index\\.[cm]?[jt]s$)`,
      },
    })),
    {
      name: 'runtime-only-module-adapters',
      severity: 'error',
      from: { path: '^packages/backend/src/runtime/' },
      to: {
        path: '^packages/backend/src/modules/[^/]+/(?!index\\.[cm]?[jt]s$|infrastructure/)',
      },
    },
    {
      name: 'integration-only-module-adapters',
      severity: 'error',
      from: { path: '^packages/backend/tests/integration/[^/]+\\.test\\.ts$' },
      to: {
        path: '^packages/backend/src/modules/[^/]+/(?!index\\.[cm]?[jt]s$|infrastructure/)',
      },
    },
    {
      name: 'app-runtime-only-bootstrap',
      severity: 'error',
      from: {
        path: '^apps/(api|worker)/',
        pathNot:
          '^apps/(?:api/src/bootstrap/start-api|worker/src/bootstrap/start-worker|worker/src/cli/diagnostic)\\.ts$',
      },
      to: { path: '^packages/backend/src/runtime/' },
    },
    {
      name: 'web-no-server',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: { path: '^packages/(backend|database)/' },
    },
    {
      name: 'contracts-no-server',
      severity: 'error',
      from: { path: '^packages/contracts/' },
      to: { path: '^packages/(backend|database)/' },
    },
    {
      name: 'ui-no-business',
      severity: 'error',
      from: { path: '^packages/ui/' },
      to: { path: '^packages/(backend|database|contracts)/' },
    },
    {
      name: 'domain-no-infrastructure',
      severity: 'error',
      from: { path: '^packages/backend/src/modules/[^/]+/domain/' },
      to: {
        path: '^packages/(database|backend/src/.*/(infrastructure|runtime))/',
      },
    },
    {
      name: 'domain-no-external',
      severity: 'error',
      from: { path: '^packages/backend/src/modules/[^/]+/domain/' },
      to: {
        dependencyTypes: ['core', 'npm', 'npm-dev', 'npm-optional', 'npm-peer'],
      },
    },
    {
      name: 'profiles-no-builtins',
      severity: 'error',
      from: { path: '^packages/backend/src/profiles/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'profiles-no-external-except-zod',
      severity: 'error',
      from: { path: '^packages/backend/src/profiles/' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'],
        pathNot: '(^|/)zod(/|$)',
      },
    },
    {
      name: 'modules-no-workflows',
      severity: 'error',
      from: { path: '^packages/backend/src/modules/' },
      to: { path: '^packages/backend/src/workflows/' },
    },
    {
      name: 'database-private',
      severity: 'error',
      from: {
        path: '^(apps|packages/backend)/',
        pathNot:
          '^packages/backend/(?:src/(?:modules/[^/]+/infrastructure|runtime)/|tests/integration/[^/]+\\.test\\.ts$)',
      },
      to: { path: '^packages/database/' },
    },
    {
      name: 'profiles-no-io',
      severity: 'error',
      from: { path: '^packages/backend/src/profiles/' },
      to: {
        path: '^packages/(database|backend/src/(runtime|workflows|platform|modules/[^/]+/infrastructure))/',
      },
    },
    {
      name: 'platform-no-business',
      severity: 'error',
      from: { path: '^packages/backend/src/platform/' },
      to: { path: '^packages/backend/src/(modules|profiles|workflows)/' },
    },
  ],
  options: {
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
    doNotFollow: { path: 'node_modules|^packages/database/generated/' },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
  },
};
