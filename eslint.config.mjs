import base from '@anyko/eslint-config/base';

import {
  architectureRules,
  restrictedIoGlobals,
} from './packages/eslint-config/architecture.js';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      'packages/database/generated/**',
      'graphify-out/**',
      'work/**',
      'docs/brand/**',
    ],
  },
  ...base.map((config) => ({
    ...config,
    files: [
      'apps/**/*.{ts,tsx}',
      'packages/**/src/**/*.{ts,tsx}',
      'packages/**/tests/**/*.{ts,tsx}',
      'tests/**/*.{ts,tsx}',
    ],
  })),
  {
    files: [
      'apps/**/*.{js,mjs,cjs,ts,tsx}',
      'packages/**/*.{js,mjs,cjs,ts,tsx}',
    ],
    plugins: { architecture: { rules: architectureRules } },
    rules: { 'architecture/no-cross-package-source': 'error' },
  },
  {
    files: [
      'packages/backend/src/modules/*/domain/**/*.{js,mjs,cjs,ts,tsx}',
      'packages/backend/src/profiles/**/*.{js,mjs,cjs,ts,tsx}',
    ],
    rules: { 'no-restricted-globals': ['error', ...restrictedIoGlobals] },
  },
  {
    files: ['apps/api/src/http/routes/**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: [
      // Временно: разбор входа ещё в маршрутах; сокращается этапом #17 (ADR 0009).
      'apps/api/src/http/routes/works.ts',
      'apps/api/src/http/routes/documents.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(json|formData)$/][callee.object.name='request']",
          message:
            'Разбор входа выполняет route() по endpoint-описанию (ADR 0009, этап 3); не вызывайте request.json() или request.formData() в маршруте.',
        },
      ],
    },
  },
  {
    files: [
      'packages/backend/src/modules/*/domain/**/*.{js,mjs,cjs,ts,tsx}',
      'packages/backend/src/modules/*/application/**/*.{js,mjs,cjs,ts,tsx}',
    ],
    ignores: [
      // Временно: сокращается этапами #19/#21 (часы и ID сценариев).
      'packages/backend/src/modules/documents/application/service.ts',
      'packages/backend/src/modules/processing/application/service.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            'Получайте часы через зависимости сценария (например, clock.now()), а не new Date() без аргументов.',
        },
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            'Получайте часы через зависимости сценария (например, clock.now()), а не Date.now().',
        },
        {
          selector:
            "CallExpression[callee.object.name='crypto'][callee.property.name='randomUUID']",
          message:
            'Получайте ID через зависимости сценария, а не crypto.randomUUID() внутри domain или application.',
        },
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message:
            'Получайте настройки через зависимости сценария, а не process.env внутри domain или application.',
        },
      ],
    },
  },
  {
    // backend-runtime-no-process-env (ADR 0009): composition получает уже разобранную BackendConfig.
    files: ['packages/backend/src/runtime/**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message:
            'runtime получает настройки аргументом (BackendConfig); process.env читают только bootstrap приложений.',
        },
      ],
    },
  },
];
