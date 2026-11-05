module.exports = {
  forbidden: [
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
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
          '^packages/backend/src/(modules/[^/]+/infrastructure|runtime)/',
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
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
  },
};
