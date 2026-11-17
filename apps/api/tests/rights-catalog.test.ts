import { expect, test } from 'bun:test';

import { rightCatalog } from '@anyko/backend/scope';
import { rights } from '@anyko/contracts/session';

// Каталог прав в contracts и права backend меняются одновременно: расхождение ломает web (useCan).
test('the rights catalog in contracts matches the backend rights exactly', () => {
  expect([...rights].sort()).toEqual([...rightCatalog].sort());
});
