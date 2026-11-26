import { expect, test } from 'bun:test';

import { analysisPolicyRevisionInput } from '../src/modules/agents';
import {
  type AnalysisPlan,
  validateAnalysisPlan,
} from '../src/profiles/analysis-plan';
import { createProcessingProfiles } from '../src/runtime/processing-profiles';
import { workAnalysisRevision } from '../src/workflows/work-analysis/revision';

test('resolved BFL v12 analysis carries field roles and declared types', () => {
  const { analysis } =
    createProcessingProfiles(true).resolve('bfl-bankruptcy-v12');
  const fields = new Map(analysis.fields.map((field) => [field.key, field]));
  expect(fields.get('inn')).toMatchObject({ valueType: 'inn', role: 'debtor' });
  expect(fields.get('documentNumber')).toMatchObject({
    valueType: 'passport',
    role: 'debtor',
  });
  expect(fields.get('courtAddress')).toMatchObject({
    valueType: 'address',
    role: 'court',
  });
  expect(fields.get('birthDate')?.valueType).toBe('date');
  expect(fields.get('cashOnHand')?.valueType).toBe('money');
  const debtColumns = new Map(
    fields.get('debts')?.columns.map(({ key, valueType }) => [key, valueType]),
  );
  expect(debtColumns.get('contractDate')).toBe('date');
  expect(debtColumns.get('amount')).toBe('money');
});

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

test('a checkpoint revision changes when the plan is reordered or its instructions change', () => {
  const {
    analysis: { fields, plan, policy },
    profile,
  } = createProcessingProfiles(true).resolve('bfl-bankruptcy-v14');
  const [first, second, ...remaining] = plan?.steps ?? [];
  if (!plan || !first || !second) throw new Error('MISSING_ANALYSIS_PLAN');

  const revision = workAnalysisRevision(fields, plan, profile, policy);
  expect(
    workAnalysisRevision(fields, structuredClone(plan), profile, policy),
  ).toBe(revision);
  expect(
    workAnalysisRevision(
      fields,
      plan,
      { ...profile, revision: 'next' },
      policy,
    ),
  ).not.toBe(revision);
  expect(
    workAnalysisRevision(
      fields,
      {
        ...plan,
        steps: [second, first, ...remaining],
      },
      profile,
      policy,
    ),
  ).not.toBe(revision);
  expect(
    workAnalysisRevision(
      fields,
      {
        ...plan,
        steps: [
          { ...first, instructions: 'Уточни дату выдачи.' },
          second,
          ...remaining,
        ],
      },
      profile,
      policy,
    ),
  ).not.toBe(revision);
});

test('profile extraction instructions invalidate extraction without changing step checkpoints', () => {
  const profiles = createProcessingProfiles(true);
  const updated = 'Извлеки номер договора с его титульной страницы.';
  const descriptions = structuredClone(profiles.publications);
  for (const { analysis } of descriptions)
    if (analysis.instructions) analysis.instructions.extraction = updated;
  const changed = createProcessingProfiles(true, [], descriptions);
  const revision = (pack: ReturnType<typeof profiles.resolve>) => {
    const { fields, plan, policy } = pack.analysis;
    return workAnalysisRevision(fields, plan, pack.profile, policy);
  };
  const extraction = changed.resolve('bfl-bankruptcy-v12');
  const { fields, policy } = extraction.analysis;
  const prompt = analysisPolicyRevisionInput(
    fields,
    false,
    policy,
  ).instructions;
  expect(prompt).toContain(updated);
  expect(prompt).not.toContain('"key":"submittedAttachments"');
  expect(revision(extraction)).not.toBe(
    revision(profiles.resolve('bfl-bankruptcy-v12')),
  );
  expect(revision(changed.resolve('bfl-bankruptcy-v14'))).toBe(
    revision(profiles.resolve('bfl-bankruptcy-v14')),
  );
});
