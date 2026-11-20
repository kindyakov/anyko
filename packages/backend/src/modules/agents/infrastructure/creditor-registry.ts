import { z } from 'zod';

const cbrEndpoint = 'https://www.cbr.ru/FO_ZoomWS/FinOrg.asmx';
const fnsEndpoint = 'https://pb.nalog.ru/';
const maximumMatches = 6;
const innSchema = z.string().regex(/^\d{10}$/u);
const ogrnSchema = z.string().regex(/^[15]\d{12}$/u);
const creditorNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(220)
  .regex(/^[\p{L}\p{N} «»"„“”().,&'–—-]+$/u)
  .refine((value) => /\p{L}/u.test(value));
const legalForm =
  /(?:^(?:пао|нао|ао|ооо|зао|оао|нко|фгуп|гуп|муп|общество|(?:публичное |непубличное )?акционерное общество|банк|мкк|мфк)(?:\s|$)|банк$)/iu;

export const creditorLookupInput = z
  .strictObject({
    source: z.enum(['cbr', 'fns']),
    inn: innSchema.optional(),
    ogrn: ogrnSchema.optional(),
    name: creditorNameSchema.optional(),
  })
  .refine(({ inn, ogrn, name }) => Boolean(inn || ogrn || name));

export type CreditorQuery = z.infer<typeof creditorLookupInput>;
type CreditorOrganisation = {
  fullName: string;
  shortName?: string;
  inn: string;
  ogrn: string;
  address?: string;
  kpp?: string;
  bic?: string;
  url: string;
};
export type CreditorLookup = {
  source: CreditorQuery['source'];
  checkedAt: string;
  status: 'found' | 'partial' | 'ambiguous' | 'not_found' | 'unavailable';
  organisations: CreditorOrganisation[];
};

export function creditorNameKey(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .replace(/[«»"„“”]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function creditorRegistryQuery(
  row: Record<string, string | null>,
  source: CreditorQuery['source'],
): CreditorQuery | undefined {
  const inn = innSchema.safeParse(row.inn?.replace(/\s/gu, ''));
  const ogrn = ogrnSchema.safeParse(row.ogrn?.replace(/\s/gu, ''));
  if (inn.success || ogrn.success) {
    return {
      source,
      ...(inn.success && { inn: inn.data }),
      ...(ogrn.success && { ogrn: ogrn.data }),
    };
  }
  const name = creditorNameSchema.safeParse(row.name);
  if (!name.success || !legalForm.test(creditorNameKey(name.data))) return;
  return { source, name: name.data };
}

type Request = (url: string, init?: RequestInit) => Promise<Response>;

function xmlText(value: string, tag: string) {
  const match = new RegExp(
    '<' + tag + '(?:\\s[^>]*)?>([^<]*)</' + tag + '>',
    'iu',
  ).exec(value);
  return (
    match?.[1]
      ?.replace(
        /&(amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/giu,
        (entity, key: string) => {
          const named: Record<string, string> = {
            amp: '&',
            quot: '"',
            apos: "'",
            lt: '<',
            gt: '>',
          };
          if (!key.startsWith('#')) return named[key] ?? entity;
          const hex = key[1] === 'x';
          const code = Number.parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
          return code > 0 && code <= 0x10ffff
            ? String.fromCodePoint(code)
            : entity;
        },
      )
      .trim()
      .slice(0, 1000) || undefined
  );
}

function registryOrganisation(
  names: { fullName: string; shortName?: string | undefined },
  ids: { inn?: string | undefined; ogrn?: string | undefined },
  fields: {
    address?: string | undefined;
    kpp?: string | undefined;
    bic?: string | undefined;
  },
  url: string,
): CreditorOrganisation | undefined {
  const inn = innSchema.safeParse(ids.inn);
  const ogrn = ogrnSchema.safeParse(ids.ogrn);
  if (!inn.success || !ogrn.success || !names.fullName.trim()) return;
  return {
    fullName: names.fullName.trim().slice(0, 1000),
    ...(names.shortName?.trim() && {
      shortName: names.shortName.trim().slice(0, 1000),
    }),
    inn: inn.data,
    ogrn: ogrn.data,
    ...(fields.address?.trim() && {
      address: fields.address.trim().slice(0, 1000),
    }),
    ...(fields.kpp && /^\d{9}$/u.test(fields.kpp) && { kpp: fields.kpp }),
    ...(fields.bic && /^\d{9}$/u.test(fields.bic) && { bic: fields.bic }),
    url,
  };
}

async function lookupCbr(query: CreditorQuery, request: Request) {
  async function soap(operation: string, parameters: string) {
    const envelope =
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><' +
      operation +
      ' xmlns="http://web.cbr.ru/">' +
      parameters +
      '</' +
      operation +
      '></soap:Body></soap:Envelope>';
    const response = await request(cbrEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'text/xml; charset=utf-8',
        SOAPAction: '"http://web.cbr.ru/' + operation + '"',
      },
      body: envelope,
    });
    const xml = await response.text();
    const body = new RegExp(
      '<' +
        operation +
        'Result(?:\\s[^>]*)?>([\\s\\S]*?)</' +
        operation +
        'Result>',
      'u',
    ).exec(xml)?.[1];
    if (body === undefined || xml.length > 2_000_000)
      throw new Error('CBR_RESPONSE_INVALID');
    return body;
  }

  async function exact(field: 'INN' | 'OGRN', id: string) {
    const result = await soap(
      'GetFullInfoBy' + field,
      '<' + field + '>' + id + '</' + field + '>',
    );
    const ogrn = xmlText(result, 'OGRN');
    if (!ogrn) return;
    return registryOrganisation(
      {
        fullName: xmlText(result, 'Name') ?? '',
        shortName: xmlText(result, 'ShortName'),
      },
      { inn: xmlText(result, 'INN'), ogrn },
      { address: xmlText(result, 'Address'), bic: xmlText(result, 'BIC') },
      'https://www.cbr.ru/finorg/foinfo/?ogrn=' + ogrn,
    );
  }

  if (query.ogrn || query.inn) {
    const result = query.ogrn
      ? await exact('OGRN', query.ogrn)
      : query.inn && (await exact('INN', query.inn));
    return { organisations: result ? [result] : [], truncated: false };
  }

  const name = (query.name ?? '').replaceAll('&', '&amp;');
  const result = await soap(
    'Search',
    '<Name>' +
      name +
      '</Name><Addr/><Status>Any</Status><FoType/><VidID>-1</VidID><OKATO>-1</OKATO><page>0</page>',
  );
  if (xmlText(result, 'IsSucess') === 'false')
    throw new Error('CBR_SEARCH_UNAVAILABLE');
  const matches = new Map<string, CreditorOrganisation>();
  for (const [, row] of result.matchAll(
    /<Record(?:\s[^>]*)?>([\s\S]*?)<\/Record>/gu,
  )) {
    if (!row) continue;
    const ogrn = xmlText(row, 'OGRN');
    if (!ogrn) continue;
    const organisation = registryOrganisation(
      { fullName: xmlText(row, 'Name') ?? '' },
      { inn: xmlText(row, 'INN'), ogrn },
      {},
      'https://www.cbr.ru/finorg/foinfo/?ogrn=' + ogrn,
    );
    if (organisation) matches.set(organisation.ogrn, organisation);
  }
  const ordered = [...matches.values()].sort(
    (a, b) =>
      Number(
        creditorNameKey(b.fullName) === creditorNameKey(query.name ?? ''),
      ) -
      Number(creditorNameKey(a.fullName) === creditorNameKey(query.name ?? '')),
  );
  const organisations = await Promise.all(
    ordered.slice(0, maximumMatches).map(async (row) => {
      try {
        const details = await exact('OGRN', row.ogrn);
        return details?.ogrn === row.ogrn && details.inn === row.inn
          ? details
          : row;
      } catch {
        return row;
      }
    }),
  );
  return {
    organisations,
    truncated:
      matches.size > maximumMatches ||
      Number(xmlText(result, 'TotalPages')) > 1,
  };
}

const fnsRow = z.object({
  namep: z.string(),
  namec: z.string().nullish(),
  inn: innSchema,
  ogrn: ogrnSchema,
  token: z.string().regex(/^[A-F0-9]{32,256}$/iu),
});
const fnsJob = z.object({
  id: z.uuid(),
  captchaRequired: z.boolean().optional(),
  token: fnsRow.shape.token.optional(),
});
const fnsSearch = z.object({
  ul: z.object({ data: z.array(z.unknown()), hasMore: z.boolean().optional() }),
});
const fnsDetails = z.object({
  vyp: z.object({
    ИНН: innSchema,
    ОГРН: ogrnSchema,
    КПП: z.string().nullish(),
    АдресРФ: z.string().nullish(),
    НаимЮЛПолн: z.string().nullish(),
    НаимЮЛСокр: z.string().nullish(),
  }),
});

async function lookupFns(
  query: CreditorQuery,
  request: Request,
  signal: AbortSignal,
) {
  async function post(endpoint: string, data: Record<string, string>) {
    const response = await request(fnsEndpoint + endpoint, {
      method: 'POST',
      body: new URLSearchParams(data),
    });
    const body = await response.text();
    if (body.length > 2_000_000) throw new Error('FNS_RESPONSE_INVALID');
    return body.trim() ? (JSON.parse(body) as unknown) : null;
  }

  async function result(endpoint: string, query: Record<string, string>) {
    const job = fnsJob.parse(await post(endpoint, query));
    if (job.captchaRequired) throw new Error('FNS_LOOKUP_UNAVAILABLE');
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await Bun.sleep(400);
      signal.throwIfAborted();
      const data = await post(endpoint, {
        id: job.id,
        method: 'get-response',
        ...(job.token && { token: job.token }),
      });
      if (data !== null) return data;
    }
    throw new Error('FNS_LOOKUP_UNAVAILABLE');
  }

  const search = fnsSearch.parse(
    await result('search-proc.json', {
      mode: 'search-ul',
      queryUl: query.ogrn ?? query.inn ?? query.name ?? '',
    }),
  );
  const matches = new Map<string, z.infer<typeof fnsRow>>();
  for (const item of search.ul.data) {
    const parsed = fnsRow.safeParse(item);
    if (parsed.success) matches.set(parsed.data.ogrn, parsed.data);
  }
  const organisations = await Promise.all(
    [...matches.values()].slice(0, maximumMatches).map(async (row) => {
      let details: z.infer<typeof fnsDetails>['vyp'] | undefined;
      try {
        const record = fnsDetails.parse(
          await result('company-proc.json', {
            token: row.token,
            method: 'get-request',
          }),
        ).vyp;
        if (record.ИНН === row.inn && record.ОГРН === row.ogrn)
          details = record;
      } catch {
        // A search match stays available for review if its full extract is unavailable.
      }
      return registryOrganisation(
        {
          fullName: details?.НаимЮЛПолн ?? row.namep,
          shortName: details?.НаимЮЛСокр ?? row.namec ?? undefined,
        },
        row,
        {
          address: details?.АдресРФ ?? undefined,
          kpp: details?.КПП ?? undefined,
        },
        'https://pb.nalog.ru/search.html#mode=search-ul&queryUl=' + row.ogrn,
      );
    }),
  );
  return {
    organisations: organisations.filter(
      (row): row is CreditorOrganisation => row !== undefined,
    ),
    truncated: matches.size > maximumMatches || search.ul.hasMore === true,
  };
}
export async function findCreditor(
  input: CreditorQuery,
  signal: AbortSignal,
  fetchPage: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<CreditorLookup> {
  const query = creditorLookupInput.parse(input);
  const base = { source: query.source, checkedAt: new Date().toISOString() };
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(6000)]);
  const request: Request = async (url, init) => {
    const response = await fetchPage(url, {
      ...init,
      redirect: 'error',
      signal: deadline,
    });
    if (!response.ok) throw new Error('CREDITOR_REGISTRY_UNAVAILABLE');
    return response;
  };
  try {
    const { organisations, truncated } = await (query.source === 'cbr'
      ? lookupCbr(query, request)
      : lookupFns(query, request, deadline));
    signal.throwIfAborted();
    const matching = organisations.filter(
      (row) =>
        (!query.inn || query.inn === row.inn) &&
        (!query.ogrn || query.ogrn === row.ogrn),
    );
    const exact = (row: CreditorOrganisation) =>
      Boolean(
        query.ogrn ||
        query.inn ||
        [row.fullName, row.shortName].some(
          (name) =>
            name && creditorNameKey(name) === creditorNameKey(query.name ?? ''),
        ),
      );
    const status =
      truncated || matching.length > 1
        ? 'ambiguous'
        : !matching[0]
          ? 'not_found'
          : !exact(matching[0]) ||
              !matching[0].address ||
              !matching[0].shortName
            ? 'partial'
            : 'found';
    return { ...base, status, organisations: matching };
  } catch {
    signal.throwIfAborted();
    return { ...base, status: 'unavailable', organisations: [] };
  }
}
