// Add an explicit edge here only after review. Values name modules whose public
// index may be imported by the owning module.
const moduleEdges = {
  access: [],
  agents: [],
  works: ['documents'],
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

// Известные нарушения web-правил. Списки только сокращаются: новое нарушение в список не добавляется.
// Известных нарушений feature-границ нет (список только сокращается).
const webKnownFeatureViolations = [];
// requestApi допустим из api/ своей feature, из lib/ и из тестов.
const webClientAllowed = [
  '^apps/web/src/lib/',
  '^apps/web/src/features/[^/]+/api/',
  '[.]test[.]tsx?$',
];
// Известных нарушений нет: список пуст и не пополняется.
const webKnownClientImporters = [];

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
      to: { path: '^packages/(backend|database|llm)/' },
    },
    {
      name: 'contracts-no-server',
      severity: 'error',
      from: { path: '^packages/contracts/' },
      to: { path: '^packages/(backend|database|llm)/' },
    },
    {
      name: 'ui-no-business',
      severity: 'error',
      from: { path: '^packages/ui/' },
      to: { path: '^packages/(backend|database|contracts|llm)/' },
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
    {
      name: 'backend-no-contracts',
      severity: 'error',
      comment:
        'backend не импортирует HTTP-контракты (ADR 0009); модель переводится presenter-ом API. Список ниже временный: сокращается этапом #20, новые строки не добавлять.',
      from: {
        path: '^packages/backend/',
        pathNot: [
          '^packages/backend/src/modules/agents/index\\.ts$',
          '^packages/backend/src/modules/agents/infrastructure/mastra\\.ts$',
          '^packages/backend/src/modules/agents/infrastructure/reconcile\\.ts$',
          '^packages/backend/src/modules/agents/infrastructure/session-store\\.ts$',
          '^packages/backend/src/modules/agents/session\\.test\\.ts$',
          '^packages/backend/src/modules/agents/session\\.ts$',
          '^packages/backend/src/modules/facts/facts\\.test\\.ts$',
          '^packages/backend/src/modules/facts/index\\.ts$',
          '^packages/backend/src/modules/facts/infrastructure/store\\.ts$',
          '^packages/backend/src/modules/generation/index\\.ts$',
          '^packages/backend/src/modules/generation/infrastructure/store\\.ts$',
          '^packages/backend/src/modules/generation/render\\.ts$',
          '^packages/backend/src/modules/processing/application/work-ports\\.ts$',
          '^packages/backend/src/modules/processing/infrastructure/work-store\\.ts$',
          '^packages/backend/src/modules/templates/index\\.ts$',
          '^packages/backend/src/modules/templates/render-data\\.ts$',
          '^packages/backend/src/modules/templates/technical\\.ts$',
          '^packages/backend/src/modules/works/index\\.ts$',
          '^packages/backend/src/modules/works/infrastructure/store\\.ts$',
          '^packages/backend/src/workflows/works/api\\.ts$',
          '^packages/backend/src/workflows/works/continue-session\\.ts$',
          '^packages/backend/src/workflows/works/execute\\.ts$',
          '^packages/backend/tests/integration/session-agent\\.test\\.ts$',
          '^packages/backend/tests/integration/works\\.test\\.ts$',
          '^packages/backend/tests/templates\\.test\\.ts$',
        ],
      },
      to: { path: '^packages/contracts/' },
    },
    {
      name: 'backend-no-transport-libs',
      severity: 'error',
      comment:
        'backend не зависит от Elysia, BullMQ и ioredis: очередь и HTTP-сервер живут в apps и в адаптерах runtime. Список ниже временный: сокращается этапом #21, новые строки не добавлять.',
      from: {
        path: '^packages/backend/',
        pathNot: [
          '^packages/backend/src/runtime/diagnostics/client\\.ts$',
          '^packages/backend/src/runtime/diagnostics/worker\\.ts$',
          '^packages/backend/src/runtime/documents/worker\\.ts$',
          '^packages/backend/src/runtime/works/worker\\.ts$',
          '^packages/backend/tests/integration/diagnostic-worker\\.test\\.ts$',
          '^packages/backend/tests/integration/documents\\.test\\.ts$',
        ],
      },
      to: { path: '(^|/)node_modules/(?:elysia|bullmq|ioredis)/' },
    },
    {
      name: 'backend-contracts-only-zod',
      severity: 'error',
      comment:
        'contracts зависит только от zod: браузерные схемы не тянут серверные и другие пакеты.',
      from: { path: '^packages/contracts/' },
      to: { pathNot: ['^packages/contracts/', '(^|/)zod(/|$)'] },
    },
    {
      name: 'backend-modules-database-types-only',
      severity: 'error',
      comment:
        'Модули, сценарии и примитивы получают клиент БД от composition root (ADR 0009): значения @anyko/database импортирует только runtime и интеграционные тесты; типы разрешены.',
      from: {
        path: '^packages/backend/src/(modules|workflows|platform|profiles)/',
      },
      to: { path: '^packages/database/', dependencyTypesNot: ['type-only'] },
    },
    // Web (apps/web): правила через пути и обратные ссылки, без перечисления features.
    // Известных нарушений web-границ нет (списки пусты и не пополняются):
    // см. webKnownFeatureViolations и webKnownClientImporters ниже.
    {
      name: 'web-feature-public-api',
      comment:
        'Импортируйте из другой feature только её index.ts и реэкспортируйте нужное там. Глубокий импорт features/<b>/... запрещён; app/ тоже ходит в features только через index.ts.',
      severity: 'error',
      from: {
        path: '^apps/web/src/(?:features/([^/]+)|app)/',
        pathNot: webKnownFeatureViolations,
      },
      to: {
        path: '^apps/web/src/features/(?!$1/)[^/]+/',
        pathNot: '^apps/web/src/features/[^/]+/index[.]ts$',
      },
    },
    {
      name: 'web-no-feature-cycles',
      comment:
        'Цикл между features недопустим. Общий код вынесите в lib/ или перенесите координацию сценария в экран app/.',
      severity: 'error',
      from: { path: '^apps/web/src/features/([^/]+)/' },
      to: {
        path: '^apps/web/src/features/(?!$1/)[^/]+/',
        circular: true,
      },
    },
    {
      name: 'web-features-no-app',
      comment:
        'features и components не импортируют app/. Передайте данные или обработчики пропсами; маршрутные файлы остаются в app/.',
      severity: 'error',
      from: { path: '^apps/web/src/(?:features|components)/' },
      to: { path: '^apps/web/src/app/' },
    },
    {
      name: 'web-components-no-features',
      comment:
        'components/ — общие примитивы без предметного смысла. Не импортируйте features/ и lib/api/: передайте данные пропсами, а предметную логику оставьте в feature.',
      severity: 'error',
      from: { path: '^apps/web/src/components/' },
      to: { path: '^apps/web/src/(?:features/|lib/api/)' },
    },
    {
      name: 'web-api-client-in-api',
      comment:
        'requestApi вызывается только из features/<name>/api/ и lib/. Вынесите запрос в api/ своей feature через queryOptions или useMutation.',
      severity: 'error',
      from: {
        path: '^apps/web/',
        pathNot: [...webClientAllowed, ...webKnownClientImporters],
      },
      to: { path: '^apps/web/src/lib/api/client[.]ts$' },
    },
    {
      name: 'web-server-only',
      comment:
        'lib/server содержит server-only конфигурацию и сессию. Из features, components и lib/api читайте данные через API или пропсы серверного компонента.',
      severity: 'error',
      from: { path: '^apps/web/src/(?:features/|components/|lib/api/)' },
      to: { path: '^apps/web/src/lib/server/' },
    },
    {
      name: 'web-no-contracts-admin',
      comment:
        'Пользовательский web не использует административные контракты. Используйте @anyko/contracts/<ресурс> для пользовательских ресурсов.',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: {
        path: ['^packages/contracts/src/admin/', '^@anyko/contracts/admin'],
      },
    },
  ],
  options: {
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
    doNotFollow: { path: 'node_modules|^packages/database/generated/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'apps/web/tsconfig.json' },
    combinedDependencies: true,
  },
};
