// Add an explicit edge here only after review. Values name modules whose public
// index may be imported by the owning module.
const moduleEdges = {
  access: ['audit'],
  agents: [],
  works: ['documents'],
  cases: [],
  documents: [],
  processing: [],
  connections: ['audit'],
  facts: [],
  templates: [],
  generation: [],
  idempotency: [],
  audit: [],
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
      comment:
        'Композиция собирает фасад модуля (module.ts: createXModule) и хранилища (infrastructure); публичный index.ts даёт типы. application и domain закрыты (ADR 0009).',
      severity: 'error',
      from: { path: '^packages/backend/src/runtime/' },
      to: {
        path: '^packages/backend/src/modules/[^/]+/(?!index\\.[cm]?[jt]s$|module\\.[cm]?[jt]s$|infrastructure/)',
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
      comment:
        '@anyko/ui не знает о приложениях, контрактах, сервере и Next: данные и обработчики приходят пропсами, маршрутизация и изображения остаются в apps/web.',
      severity: 'error',
      from: { path: '^packages/ui/' },
      to: {
        path: '^(?:packages/(?:backend|database|contracts|llm)/|apps/|next(?:/|$))|(?:^|/)node_modules/next/',
      },
    },
    {
      name: 'ui-brand-isolated',
      comment:
        'Фоновая графика бренда тянет WebGL и canvas. Корень @anyko/ui и @anyko/ui/form её не импортируют, чтобы примитивы не утяжеляли каждую страницу; графика подключается только через @anyko/ui/brand.',
      severity: 'error',
      from: { path: '^packages/ui/src/(?!brand/)' },
      to: { path: '^packages/ui/src/brand/' },
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
        'backend не импортирует HTTP-контракты (ADR 0009); API переводит модель в сетевой формат.',
      from: { path: '^packages/backend/' },
      to: { path: '^packages/contracts/' },
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
    {
      name: 'backend-workflows-use-module-facades',
      comment:
        'Процесс использует модуль только через index.ts (типы) и module.ts (тип фасада), а не через application, domain или infrastructure (ADR 0009). Фасад получает через зависимости от runtime. Известных нарушений нет: процессы этапа 5b импортируют публичные index.ts, поэтому список исключений пуст и не заводится.',
      severity: 'error',
      from: { path: '^packages/backend/src/workflows/' },
      to: {
        path: '^packages/backend/src/modules/[^/]+/(?:application|domain|infrastructure)/',
      },
    },
    {
      name: 'backend-transactions-opaque',
      comment:
        'UnitOfWork передаёт сценарию непрозрачный Tx (ADR 0009): процессы не импортируют клиент Prisma и его значения; типы драйвера допустимы.',
      severity: 'error',
      from: { path: '^packages/backend/src/workflows/' },
      to: { path: '^packages/database/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'backend-scope-issued-by-access',
      comment:
        'WorkspaceScope выдаёт только modules/access после проверки участия (ADR 0009): выдающий файл platform/scope/issue.ts импортирует только access.',
      severity: 'error',
      from: {
        pathNot: [
          '^packages/backend/src/modules/access/',
          '^packages/backend/src/platform/scope/issue[.]ts$',
        ],
      },
      to: { path: '^packages/backend/src/platform/scope/issue[.]ts$' },
    },
    {
      name: 'backend-execution-scope-issued-by-processing',
      severity: 'error',
      from: {
        pathNot: [
          '^packages/backend/src/modules/processing/',
          '^packages/backend/src/platform/scope/issue-execution[.]ts$',
        ],
      },
      to: {
        path: '^packages/backend/src/platform/scope/issue-execution[.]ts$',
      },
    },
    {
      name: 'backend-no-queue-libs',
      severity: 'error',
      from: { path: '^packages/backend/' },
      to: { path: '(^|/)node_modules/(?:elysia|bullmq|ioredis)/' },
    },
    {
      name: 'backend-no-apps',
      severity: 'error',
      from: { path: '^packages/backend/' },
      to: {
        path: '^(?:apps/|@anyko/(?:worker|api)(?:/|$))|(?:^|/)node_modules/@anyko/(?:worker|api)(?:/|$)',
      },
    },
    // Web (apps/web): правила через пути и обратные ссылки, без перечисления features.
    // Известных нарушений web-границ нет (список пуст и не пополняется): см. webKnownFeatureViolations.
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
        'features не импортируют app/. Передайте данные или обработчики пропсами; маршрутные файлы остаются в app/.',
      severity: 'error',
      from: { path: '^apps/web/src/features/' },
      to: { path: '^apps/web/src/app/' },
    },
    {
      name: 'web-api-transport-only-in-lib',
      comment:
        'features и app ходят в API только через callApi или endpointUrl из lib/api/call (endpoint-описание задаёт путь, схемы и ключ). requestApi из lib/api/client — внутренний транспорт lib/api.',
      severity: 'error',
      from: { path: '^apps/web/src/(?:features|app)/' },
      to: { path: '^apps/web/src/lib/api/client[.]ts$' },
    },
    {
      name: 'web-server-only',
      comment:
        'lib/server содержит server-only конфигурацию и сессию. Из features и lib/api читайте данные через API или пропсы серверного компонента.',
      severity: 'error',
      from: { path: '^apps/web/src/(?:features/|lib/api/)' },
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
