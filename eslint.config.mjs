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
];
