import { expect, test } from 'bun:test';
import path from 'node:path';

import { uncoveredBunTests } from '../../scripts/bun-test-coverage.mjs';

test('Bun test paths cover exact files and directories relative to the manifest', () => {
  const root = path.resolve('fixture-repo');
  const uncovered = uncoveredBunTests(
    root,
    [
      'apps/example/src/covered.test.tsx',
      'apps/example/src-old/orphan.test.ts',
      'apps/example/setup.test.ts',
      'apps/example/other-setup.test.ts',
      'apps/example/quoted dir/covered.test.ts',
      'src/wrong-workspace.test.ts',
      'tests/exact.test.ts',
      'tests/exact.test.tsx',
      'tests/e2e/journey.spec.ts',
      'work/probe.test.ts',
    ],
    [
      {
        file: path.join(root, 'package.json'),
        manifest: { scripts: { test: 'bun test tests/exact.test.ts' } },
      },
      {
        file: path.join(root, 'apps/example/package.json'),
        manifest: {
          scripts: {
            test: 'bun test --preload ./setup.test.ts --preload="./other-setup.test.ts" src && bun test "quoted dir"',
          },
        },
      },
    ],
  );
  expect(uncovered).toEqual([
    'apps/example/src-old/orphan.test.ts',
    'apps/example/setup.test.ts',
    'apps/example/other-setup.test.ts',
    'src/wrong-workspace.test.ts',
    'tests/exact.test.tsx',
  ]);
});
