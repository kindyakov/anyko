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
  // Известные нарушения: список только сокращается; убираются в #10.
  // Эти эффекты и вызов в рендере меняют поведение, поэтому исправляются отдельно от настройки правил.
  {
    files: [
      'apps/web/src/features/documents/document-workspace.tsx',
      'apps/web/src/features/works/package-preview.tsx',
    ],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
  {
    files: ['apps/web/src/features/works/work-review.tsx'],
    rules: { 'react-hooks/purity': 'off' },
  },
  // Известные нарушения jsx-a11y-x: список только сокращается; убираются в #10.
  // autoFocus в окне создания работы — намеренный фокус на названии; label оборачивает Base UI Radio.Root,
  // который правило не видит как контрол.
  {
    files: ['apps/web/src/features/works/work-list.tsx'],
    rules: {
      'jsx-a11y-x/no-autofocus': 'off',
      'jsx-a11y-x/label-has-associated-control': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: { '@eslint-community/eslint-comments': eslintComments },
    rules: {
      '@eslint-community/eslint-comments/require-description': 'error',
    },
  },
];
