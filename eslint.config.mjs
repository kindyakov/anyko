import base from '@anyko/eslint-config/base';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
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
];
