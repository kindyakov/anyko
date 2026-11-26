import { expect, test } from 'bun:test';
import path from 'node:path';

import { architectureDocumentErrors } from '../../scripts/project-documents.mjs';

test('workspace architecture requires both a file and a root AGENTS link', () => {
  const root = path.resolve('fixture-repo');
  const registered = path.join(root, 'apps/api/ARCHITECTURE.md');
  const unlinked = path.join(root, 'packages/ui/ARCHITECTURE.md');
  const missing = path.join(root, 'apps/worker/ARCHITECTURE.md');
  const markdown = new Map([
    [
      path.join(root, 'AGENTS.md'),
      '| [API](apps/api/ARCHITECTURE.md) | [Worker](apps/worker/ARCHITECTURE.md) |',
    ],
    [registered, '# API'],
    [unlinked, '# UI'],
  ]);
  expect(
    architectureDocumentErrors(
      root,
      [registered, unlinked, missing],
      [],
      markdown,
    ),
  ).toEqual([
    'создайте packages/ui/ARCHITECTURE.md и добавьте ссылку в таблицу AGENTS.md',
    'создайте apps/worker/ARCHITECTURE.md и добавьте ссылку в таблицу AGENTS.md',
  ]);
});

test('workspace docs resolve Cyrillic heading anchors and reject absent or fenced headings', () => {
  const root = path.resolve('fixture-repo');
  const source = path.join(root, 'apps/api/ARCHITECTURE.md');
  const rules = path.join(root, 'docs/rules.md');
  const markdown = new Map([
    [path.join(root, 'AGENTS.md'), ''],
    [
      source,
      [
        '## Обзор API',
        '[Обзор](#обзор-api)',
        '[Правила](../../docs/rules.md#типы-и-границы-данных)',
        '[Устаревшая ссылка](../../docs/rules.md#старые-правила)',
        '[Пример](../../docs/rules.md#условный-заголовок)',
      ].join('\n'),
    ],
    [
      rules,
      [
        '## Типы и границы, данных! ##',
        '```md',
        '## Условный заголовок',
        '```',
      ].join('\n'),
    ],
  ]);
  expect(architectureDocumentErrors(root, [], [source], markdown)).toEqual([
    'apps/api/ARCHITECTURE.md: исправьте якорь в ссылке ../../docs/rules.md#старые-правила',
    'apps/api/ARCHITECTURE.md: исправьте якорь в ссылке ../../docs/rules.md#условный-заголовок',
  ]);
});
