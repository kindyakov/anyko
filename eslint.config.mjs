import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';

import base from '@anyko/eslint-config/base';
import frontend, { frontendTests } from '@anyko/eslint-config/frontend';

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

  // apps/web: frontend rules are added on top of the base block above
  // (the base block still applies to web, so frontend rules only extend it).
  ...frontend.map((config) => ({
    ...config,
    files: ['apps/web/**/*.{ts,tsx}'],
  })),
  {
    ...frontendTests,
    files: ['apps/web/**/*.test.{ts,tsx}'],
  },
  {
    files: ['apps/web/src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@tanstack/react-form', '@tanstack/react-form/*'],
              message:
                'Используйте useAppForm из @anyko/ui/form: features не импортируют @tanstack/react-form напрямую.',
            },
            {
              group: ['zustand/middleware', 'zustand/middleware/*'],
              message:
                'persist запрещён: черновики и серверные данные не хранятся в браузере.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['localStorage', 'sessionStorage', 'indexedDB'].map((name) => ({
          name,
          message:
            'Браузерное хранилище запрещено в features: черновик живёт в памяти формы, серверные данные в TanStack Query, клиентские настройки в Zustand без persist.',
        })),
      ],
      'no-restricted-properties': [
        'error',
        ...['localStorage', 'sessionStorage', 'indexedDB'].flatMap((property) =>
          ['window', 'globalThis'].map((object) => ({
            object,
            property,
            message:
              'Браузерное хранилище запрещено в features: черновик живёт в памяти формы, серверные данные в TanStack Query, клиентские настройки в Zustand без persist.',
          })),
        ),
      ],
    },
  },
  // Известные нарушения: список только сокращается; новые файлы сюда не добавляются.
  // Эти эффекты и вызов в рендере меняют поведение, поэтому исправляются отдельно от настройки правил.
  {
    files: ['apps/web/src/features/fact-review/package-preview.tsx'],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: { '@eslint-community/eslint-comments': eslintComments },
    rules: {
      '@eslint-community/eslint-comments/require-description': 'error',
    },
  },
];
