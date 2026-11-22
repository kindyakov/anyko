import { expect, test } from 'bun:test';

import {
  type AnalysisPlan,
  validateAnalysisPlan,
} from '../src/profiles/analysis-plan';

test('a package must assign each automatic field to a writable step', () => {
  const fields = ['plaintiffInn', 'defendantInn'];
  const collect = {
    key: 'parties',
    title: 'Стороны',
    kind: 'collect',
    instructions: 'Укажи ИНН каждой стороны.',
    fields,
  } as const;
  const review = {
    key: 'review',
    title: 'Сверка',
    kind: 'review',
    instructions: 'Сверь реквизиты.',
    fields: [],
  } as const;
  const plan: AnalysisPlan = { revision: 'claim-1', steps: [collect, review] };
  expect(validateAnalysisPlan(plan, fields)).toEqual(plan);
  expect(() =>
    validateAnalysisPlan(
      {
        ...plan,
        steps: [
          { ...collect, fields: ['plaintiffInn'] },
          { ...review, fields: ['defendantInn'] },
        ],
      },
      fields,
    ),
  ).toThrow('INVALID_ANALYSIS_PLAN');
});
