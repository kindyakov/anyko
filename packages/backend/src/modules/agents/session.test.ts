import { expect, test } from 'bun:test';
import { combineCandidates, selectSessionCandidates } from './session';
import { agentSessionContextSchema } from '@anyko/contracts';

test('context additions cannot erase contradictory document proposals and duplicate evidence is bounded', () => {
  const id = crypto.randomUUID();
  const original = {
    field: 'personName' as const,
    value: 'Анна',
    evidence: [{ documentId: id, imagePath: null, quote: 'Анна' }],
  };
  const other = {
    ...original,
    value: 'Ирина',
    evidence: [{ documentId: id, imagePath: null, quote: 'Ирина' }],
  };
  const combined = combineCandidates(
    [original, other],
    [{ ...original, origin: 'context' }],
  );
  expect(combined).toHaveLength(2);
  expect(combined.map((c) => c.value)).toEqual(['Анна', 'Ирина']);
});
test('persisted context rejects incompatible prompt and shape versions', () => {
  expect(
    agentSessionContextSchema.safeParse({ version: 2, summary: 'old' }).success,
  ).toBe(false);
});

test('overflowing optional context proposals preserve all 500 valid raw candidates', () => {
  const id = crypto.randomUUID();
  const raw = Array.from({ length: 500 }, (_, i) => ({
    field: 'personName' as const,
    value: String(i),
    evidence: [{ documentId: id, imagePath: null, quote: String(i) }],
  }));
  const optional = {
    ...raw[0],
    field: 'documentNumber' as const,
    value: '42',
    evidence: [{ documentId: id, imagePath: null, quote: '42' }],
    origin: 'context' as const,
  };
  const result = selectSessionCandidates(raw, [], [optional]);
  expect(result.contextAccepted).toBe(false);
  expect(result.candidates).toHaveLength(500);
  expect(result.candidates).toEqual(raw);
});
