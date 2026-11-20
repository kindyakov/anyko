import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { WorkReadContext } from '..';
import { candidateSchema } from '../../../profiles/bfl/candidate';

import {
  addressMentionsTerritory,
  type CourtLookup,
  courtTerritorySchema,
  findArbitrationCourt,
} from './arbitration-court';

export function createCourtLookupTool(
  input: Pick<WorkReadContext, 'fields' | 'assertCurrent' | 'traceTool'> & {
    signal: AbortSignal;
    lookupCourt: typeof findArbitrationCourt;
  },
) {
  const lookups = new Map<string, Promise<CourtLookup>>();
  const results: { territory: string; result: CourtLookup }[] = [];
  const enabled =
    input.fields.some(({ key }) => key === 'courtName') &&
    input.fields.some(({ key }) => key === 'courtAddress');
  if (!enabled) return { tools: {}, results, resolve: undefined };

  const resolve = async (territory: string) => {
    const toolInput = JSON.stringify({
      tool: 'lookup-arbitration-court',
      arguments: { territory },
    });
    input.signal.throwIfAborted();
    await input.assertCurrent();
    const previous = lookups.get(territory);
    if (previous) return previous;
    if (lookups.size >= 6) return undefined;

    const pending = input
      .lookupCourt(territory, input.signal)
      .then(async (result) => {
        await input.assertCurrent();
        results.push({ territory, result });
        await input.traceTool?.({
          input: toolInput,
          output: JSON.stringify(result),
          status: 'succeeded',
        });
        return result;
      });
    lookups.set(territory, pending);
    return pending;
  };
  const lookupCourt = createTool({
    id: 'lookup-arbitration-court',
    description:
      'Найти арбитражный суд по субъекту РФ в официальном каталоге и получить адрес с сайта суда. Передай только название субъекта, без полного адреса или персональных реквизитов.',
    inputSchema: z.strictObject({ territory: courtTerritorySchema }),
    execute: async ({ territory }) =>
      (await resolve(territory)) ?? { status: 'lookup_limit' },
  });
  return { tools: { lookupArbitrationCourt: lookupCourt }, results, resolve };
}

type Candidate = z.infer<typeof candidateSchema>;

function courtCandidates(
  lookup: Awaited<ReturnType<typeof findArbitrationCourt>>,
  territory: string,
  evidence: Candidate['evidence'],
  explanation?: string,
) {
  const basis = `Территория места жительства: ${territory}. ${explanation ? `${explanation} ` : ''}`;
  const status =
    lookup.status === 'ambiguous'
      ? 'Официальные источники дают несколько вариантов. Сверьте подсудность и адрес суда.'
      : lookup.status === 'unavailable'
        ? 'Суд найден в каталоге. Проверьте адрес на странице суда.'
        : 'Суд указан для этой территории в официальном каталоге.';
  return lookup.courts.flatMap(({ name, addresses, contactUrl }) => {
    const source = {
      origin: 'inference' as const,
      evidence,
      explanation: `${basis}${status} Вариант относится к суду «${name}».`,
      courtSources: {
        catalogueUrl: lookup.catalogueUrl,
        contactUrl,
        checkedAt: lookup.checkedAt,
        courtName: name,
      },
    };
    const proposals = [
      { field: 'courtName', value: name },
      ...addresses.map((value) => ({ field: 'courtAddress', value })),
    ];
    return proposals.flatMap((candidate) => {
      const parsed = candidateSchema.safeParse({ ...candidate, ...source });
      return parsed.success ? [parsed.data] : [];
    });
  });
}

export async function reviewCourtCandidates(
  input: Pick<WorkReadContext, 'facts' | 'candidates'>,
  lookup: ReturnType<typeof createCourtLookupTool>,
  courtClaims: Candidate[],
  hasValidEvidence: (candidate: Candidate) => Promise<boolean>,
) {
  if (!lookup.resolve) return [];

  const grounds = [
    ...new Set([...input.candidates, ...input.facts.candidates]),
  ].filter(
    ({ field, value, origin }) =>
      (field === 'region' ||
        field === 'registrationAddress' ||
        field === 'city' ||
        field === 'locality') &&
      origin !== 'inference' &&
      typeof value === 'string' &&
      ((!input.facts.manual.includes(field) &&
        !input.facts.confirmed.includes(field)) ||
        value === input.facts.values[field]),
  );
  const validated = new Map<Candidate, Promise<boolean>>();
  const verify = (candidate: Candidate) => {
    const result = validated.get(candidate) ?? hasValidEvidence(candidate);
    validated.set(candidate, result);
    return result;
  };

  for (const ground of grounds) {
    if (ground.field !== 'region') continue;
    const parsed = courtTerritorySchema.safeParse(ground.value);
    if (
      parsed.success &&
      !lookup.results.some(({ territory }) =>
        addressMentionsTerritory(parsed.data, territory),
      ) &&
      (await verify(ground))
    ) {
      await lookup.resolve(parsed.data);
    }
  }

  const candidates: Candidate[] = [];
  for (const ground of grounds) {
    if (typeof ground.value !== 'string') continue;
    const address = ground.value;
    const statedTerritories = lookup.results.filter(({ territory }) =>
      addressMentionsTerritory(address, territory),
    );
    if (statedTerritories.length) {
      if (await verify(ground)) {
        candidates.push(
          ...statedTerritories.flatMap(({ territory, result }) =>
            courtCandidates(result, territory, ground.evidence),
          ),
        );
      }
      continue;
    }

    if (ground.field === 'region') continue;
    for (const claim of courtClaims) {
      const groundsMatch = claim.evidence.every((evidence) =>
        ground.evidence.some(
          (item) =>
            evidence.documentId === item.documentId &&
            evidence.imagePath === item.imagePath &&
            evidence.quote === item.quote,
        ),
      );
      if (!groundsMatch) continue;
      const official = lookup.results.find(({ result }) =>
        result.courts.some(({ name, addresses }) =>
          claim.field === 'courtName'
            ? claim.value === name
            : addresses.some((address) => claim.value === address),
        ),
      );
      if (official && (await verify(ground))) {
        candidates.push(
          ...courtCandidates(
            official.result,
            official.territory,
            ground.evidence,
            claim.explanation,
          ),
        );
      }
    }
  }
  return [
    ...new Map(
      candidates.map((candidate) => [JSON.stringify(candidate), candidate]),
    ).values(),
  ];
}
