import { createTool } from '@mastra/core/tools';
import type { z } from 'zod';

import {
  obligationFields,
  sameObligation,
} from '@anyko/document-values/obligations';

import type { WorkReadContext } from '..';
import { candidateSchema } from '../../../profiles/candidate';
import type { FieldRow } from '../../../profiles/fields';

import {
  type CreditorLookup,
  creditorLookupInput,
  creditorNameKey,
  type CreditorQuery,
  creditorRegistryQuery,
  findCreditor,
  inlineCreditorLegalForm,
} from './creditor-registry';

type Candidate = z.infer<typeof candidateSchema>;

export function createCreditorLookup(
  input: Pick<WorkReadContext, 'fields' | 'assertCurrent' | 'traceTool'> & {
    signal: AbortSignal;
    lookupCreditor: typeof findCreditor;
    authorisedQuery?: (
      query: CreditorQuery,
    ) => Promise<CreditorQuery | undefined>;
  },
) {
  const lookups = new Map<string, Promise<CreditorLookup>>();
  const enabled = input.fields.some(
    ({ key, columns }) =>
      obligationFields.some((field) => field === key) &&
      columns.some(({ key }) => key === 'creditorLegalName'),
  );
  if (!enabled) return { tools: {}, resolve: undefined };

  const resolve = async (query: CreditorQuery) => {
    input.signal.throwIfAborted();
    await input.assertCurrent();
    const key = JSON.stringify(query);
    const prior = lookups.get(key);
    if (prior) return prior;
    if (lookups.size >= 12) return;
    const pending = input
      .lookupCreditor(query, input.signal)
      .then(async (result) => {
        await input.assertCurrent();
        await input.traceTool?.({
          input: JSON.stringify({
            tool: 'lookup-creditor-registry',
            arguments: query,
          }),
          output: JSON.stringify(result),
          status: 'succeeded',
        });
        return result;
      });
    lookups.set(key, pending);
    return pending;
  };
  const lookup = createTool({
    id: 'lookup-creditor-registry',
    description:
      'Поиск реквизитов юридического лица по ИНН, ОГРН или официальному наименованию кредитора из документа. Выбери cbr для банка или МФО, fns для других юридических лиц или дополнительной сверки. Передавай только реквизиты организации.',
    inputSchema: creditorLookupInput,
    execute: async (query) => {
      const authorised = await input.authorisedQuery?.(query);
      if (!authorised) return { status: 'no_verified_creditor' };
      return (await resolve(authorised)) ?? { status: 'lookup_limit' };
    },
  });
  return { tools: { lookupCreditorRegistry: lookup }, resolve };
}

function supportedQuery(
  row: FieldRow,
  text: string,
  source: CreditorQuery['source'],
) {
  const name = row.name?.trim();
  if (!name || (!row.contractNumber?.trim() && !row.basis?.trim())) return;
  const named = creditorRegistryQuery({ name }, source);
  if (!named) return;
  const key = creditorNameKey(name);
  const inn = row.inn?.replace(/\s/gu, '');
  const ogrn = row.ogrn?.replace(/\s/gu, '');
  for (const line of text.split(/\r?\n/gu)) {
    const details = line
      .normalize('NFKC')
      .trim()
      .replace(/^(?:наименование кредитора|кредитор)(?:\s*:\s*|\s+)/iu, '');
    const nameField =
      /^(?:«[^»]*»|"[^"]*"|„[^“”]*[“”]|“[^”]*”|[^«»"„“”,;|])+?(?=$|[,;|]|\s+(?:инн|огрн)(?=\s|[:№]))/iu.exec(
        details,
      )?.[0];
    if (
      !nameField ||
      (creditorNameKey(nameField) !== key &&
        creditorNameKey(nameField.replace(/\.$/u, '')) !== key)
    )
      continue;
    const tail = details.slice(nameField.length).toLocaleLowerCase('ru');
    if (
      /^,\s*\S/u.test(tail) &&
      !/^,\s*(?:инн|огрн|кпп|бик|адрес|договор|номер договора)(?=$|\s|[:№])/u.test(
        tail,
      )
    )
      continue;
    const identifiers = new Map<string, string>();
    for (const field of tail.split(/[,;|]|\s+(?=(?:инн|огрн)(?=\s|[:№]))/u)) {
      const detail = field.trim();
      if (
        !detail ||
        (/^адрес\s*:\s*\S/u.test(detail) &&
          !inlineCreditorLegalForm.test(detail))
      )
        continue;
      const [, label, number] =
        /^(инн|огрн)\s*[:№]?\s*(\d+)\.?$/u.exec(detail) ?? [];
      if (!label || !number || identifiers.has(label)) break;
      identifiers.set(label, number);
    }
    if (
      (inn && identifiers.get('инн') !== inn) ||
      (ogrn && identifiers.get('огрн') !== ogrn)
    )
      continue;
    return creditorRegistryQuery(
      { name, inn: inn || null, ogrn: ogrn || null },
      source,
    );
  }
}

async function verifiedQuery(
  row: FieldRow,
  evidence: Candidate['evidence'][number],
  source: CreditorQuery['source'],
  readSource: WorkReadContext['readSource'],
) {
  const { documentId, imagePath, quote } = evidence;
  const query = supportedQuery(row, quote, source);
  if (!query || !quote.trim()) return;
  const text = await readSource(documentId, imagePath);
  for (
    let index = text.indexOf(quote);
    index !== -1;
    index = text.indexOf(quote, index + 1)
  ) {
    const before = index === 0 ? -1 : text.lastIndexOf('\n', index - 1);
    const after = text.indexOf('\n', index + quote.length);
    const lines = text.slice(before + 1, after === -1 ? undefined : after);
    if (supportedQuery(row, lines, source)) return query;
  }
}

export async function authorisedCreditorQuery(
  input: Pick<WorkReadContext, 'facts' | 'currentFacts' | 'readSource'> & {
    documents: { id: string }[];
  },
  query: CreditorQuery,
) {
  const facts = (await input.currentFacts?.()) ?? input.facts;
  for (const candidate of facts.candidates) {
    if (
      candidate.origin === 'inference' ||
      !Array.isArray(candidate.value) ||
      !obligationFields.some((field) => field === candidate.field)
    )
      continue;
    for (const evidence of candidate.evidence) {
      if (
        !evidence.quote.trim() ||
        !input.documents.some(({ id }) => id === evidence.documentId)
      )
        continue;
      for (const row of candidate.value) {
        if (
          query.name &&
          creditorNameKey(query.name) !== creditorNameKey(row.name ?? '')
        )
          continue;
        const sourced = await verifiedQuery(
          row,
          evidence,
          query.source,
          input.readSource,
        );
        if (
          !sourced ||
          (query.inn && query.inn !== sourced.inn) ||
          (query.ogrn && query.ogrn !== sourced.ogrn)
        )
          continue;
        if (query.ogrn || query.inn) {
          return { source: query.source, inn: query.inn, ogrn: query.ogrn };
        }
        return creditorRegistryQuery({ name: row.name ?? null }, query.source);
      }
    }
  }
}

export async function reviewCreditorCandidates(
  input: Pick<WorkReadContext, 'candidates' | 'facts' | 'readSource'>,
  lookup: ReturnType<typeof createCreditorLookup>,
  hasValidEvidence: (candidate: Candidate) => Promise<boolean>,
) {
  const resolve = lookup.resolve;
  const candidates: Candidate[] = [];
  let unavailable = false;
  if (!resolve) return { candidates, unavailable };
  const issued = new Set<string>();
  for (const ground of new Set([
    ...input.candidates,
    ...input.facts.candidates,
  ])) {
    if (
      ground.origin === 'inference' ||
      !Array.isArray(ground.value) ||
      !obligationFields.some((field) => field === ground.field)
    )
      continue;
    for (const row of ground.value) {
      const saved = input.facts.values[ground.field];
      const matching = Array.isArray(saved)
        ? saved.filter((prior) => sameObligation(prior, row))
        : [];
      if (
        matching.length > 1 ||
        (!matching.length &&
          (input.facts.manual.includes(ground.field) ||
            input.facts.confirmed.includes(ground.field)))
      )
        continue;
      if (!(await hasValidEvidence(ground))) continue;
      let query: CreditorQuery | undefined;
      for (const evidence of ground.evidence) {
        query = await verifiedQuery(row, evidence, 'cbr', input.readSource);
        if (query) break;
      }
      if (!query) continue;
      const result = await resolve(query);
      // FNS can corroborate identity when the financial registry cannot match it by name.
      const fallback =
        result?.status === 'not_found' || result?.status === 'unavailable'
          ? await resolve({ ...query, source: 'fns' })
          : undefined;
      const found = fallback ?? result;
      if (!found) continue;
      unavailable ||=
        found.status === 'unavailable' ||
        (found.status === 'not_found' && result?.status === 'unavailable');

      for (const organisation of found.organisations) {
        const anchored = matching[0] ?? row;
        if (
          (anchored.inn &&
            anchored.inn.replace(/\s/gu, '') !== organisation.inn) ||
          (anchored.ogrn &&
            anchored.ogrn.replace(/\s/gu, '') !== organisation.ogrn)
        )
          continue;
        const value = [
          {
            ...anchored,
            creditorLegalName: organisation.fullName,
            creditorShortName: organisation.shortName ?? null,
            inn: organisation.inn,
            ogrn: organisation.ogrn,
            address: organisation.address ?? null,
            kpp: organisation.kpp ?? null,
            bic: organisation.bic ?? null,
          },
        ];
        const parsed = candidateSchema.safeParse({
          field: ground.field,
          value,
          evidence: ground.evidence,
          origin: 'inference',
          creditorSource: {
            registry: found.source,
            url: organisation.url,
            checkedAt: found.checkedAt,
          },
          explanation:
            found.status === 'found'
              ? 'Реквизиты кредитора из официального реестра. Сверьте их со справкой или договором.'
              : 'Возможное совпадение из официального реестра. Проверьте название, ИНН и ОГРН перед выбором.',
        });
        if (!parsed.success) continue;
        const exact = JSON.stringify([
          parsed.data.field,
          parsed.data.value,
          parsed.data.evidence,
          organisation.url,
        ]);
        if (issued.has(exact)) continue;
        issued.add(exact);
        candidates.push(parsed.data);
        if (candidates.length >= 30) return { candidates, unavailable };
      }
    }
  }
  return { candidates, unavailable };
}
