import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import testingLibrary from 'eslint-plugin-testing-library';

import base from './base.js';

// Frontend rules for apps/web. They are added on top of base; test files also get `frontendTests`.
export default [
  ...base,
  reactHooks.configs.flat['recommended-latest'],
  {
    ...nextPlugin.configs['core-web-vitals'],
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      // apps/web uses only the App Router (no pages directory); the rule checks Pages Router links.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  // jsx-a11y-x: fork of eslint-plugin-jsx-a11y that supports ESLint 10 (the original declares peer eslint ^9).
  jsxA11y.configs.recommended,
];

export const frontendTests = testingLibrary.configs['flat/react'];
