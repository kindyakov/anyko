import { z } from 'zod';

const catalogueUrl = 'https://arbitr.ru/ac/map';
const cataloguePage = 'https://arbitr.ru/' as const;
const catalogueSchema = z.array(
  z.object({
    ac1: z.array(
      z.object({
        name: z.string().min(1).max(250),
        s_name: z.string().min(1).max(250),
        cityname: z.string().nullable(),
        region_type: z.number().nullable(),
        url: z.string(),
      }),
    ),
  }),
);

export const courtTerritorySchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[а-яё .()–—-]+$/iu);

export type CourtLookup = {
  status: 'found' | 'ambiguous' | 'not_found' | 'unavailable';
  catalogueUrl: typeof cataloguePage;
  checkedAt: string;
  courts: { name: string; addresses: string[]; contactUrl: string }[];
};

function territoryKey(value: string) {
  return value
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[.()–—-]/gu, ' ')
    .replace(/^(?:г(?:орода?)?\s+)/u, '')
    .replace(/(?:ской|цкой|ной|вой|ьей)(?=\s|$)/gu, (ending) =>
      ending.slice(0, -2),
    )
    .replace(/(?:ская|цкая|ная|вая|ья)(?=\s|$)/gu, (ending) =>
      ending.slice(0, -2),
    )
    .replace(
      /(?:ского|цкого|ного|вого|ский|цкий|ный|вый)(?=\s|$)/gu,
      (ending) => ending.replace(/(?:ого|ий|ый)$/u, ''),
    )
    .replace(/(?<=\s)(?:обл|области|область)(?=\s|$)/gu, 'область')
    .replace(/(?<=\s)(?:края|край)(?=\s|$)/gu, 'край')
    .replace(/(?:^|\s)республики(?=\s|$)/gu, ' республика')
    .replace(/автономного округа/gu, 'автономный округ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function territoryMatches(
  territory: string,
  entry: z.infer<typeof catalogueSchema>[number]['ac1'][number],
) {
  const key = territoryKey(territory);
  if (
    key === territoryKey('Ненецкий автономный округ') &&
    entry.s_name.endsWith('в Ненецком АО')
  )
    return true;
  return (
    entry.s_name.split(/ и /u).some((part) => territoryKey(part) === key) ||
    (entry.region_type === 4 &&
      entry.cityname !== null &&
      territoryKey(entry.cityname) === key)
  );
}

export function addressMentionsTerritory(address: string, territory: string) {
  const normalizedAddress = territoryKey(address.replace(/[,;:]/gu, ' '));
  return ` ${normalizedAddress} `.includes(` ${territoryKey(territory)} `);
}

function courtContactUrl(site: string) {
  const url = URL.parse(site);
  if (
    !url ||
    !['http:', 'https:'].includes(url.protocol) ||
    !/^[a-z0-9-]+\.arbitr\.ru$/u.test(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    return null;
  return `https://${url.hostname}/about/mode`;
}

function normalizeText(value: string) {
  return value
    .replace(/&(?:nbsp|#160|#32|#xa0);/giu, ' ')
    .replaceAll('&ndash;', '–')
    .replaceAll('&mdash;', '—')
    .replaceAll('&laquo;', '«')
    .replaceAll('&raquo;', '»')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replace(/\s+/gu, ' ')
    .trim();
}

const addressLabel =
  /^(?:почтовый |юридический |фактический )?адрес(?: суда| местонахождения суда| \(почтовый адрес\))?\s*:\s*/iu;

// The contact page may list a mailing and visiting address for the same building.
function addressKey(address: string) {
  return address
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[.,:]/gu, ' ')
    .replace(
      /(?:^|\s)(?:россия|российская федерация|индекс|\d{6}|г|город)(?=\s|$)/gu,
      ' ',
    )
    .replace(/(?:^|\s)дом(?=\s|$)/gu, ' д')
    .replace(/\s+/gu, ' ')
    .trim();
}

function contactAddresses(html: string, presence: boolean) {
  const labelPattern = presence
    ? /^адрес постоянного судебного присутствия(?:[^:]*)\s*:\s*/iu
    : addressLabel;
  const blocks: string[] = [];
  let current = '';
  new HTMLRewriter()
    .on('.info-page__text td, .info-page__text p', {
      element(element) {
        current = '';
        element.onEndTag(() => {
          blocks.push(normalizeText(current));
        });
      },
      text(text) {
        current += text.text;
      },
    })
    .transform(html);
  const addresses = new Map<string, string>();
  for (const [index, label] of blocks.entries()) {
    if (!labelPattern.test(label)) continue;
    const address = label.replace(labelPattern, '') || blocks[index + 1];
    if (
      address &&
      address.length <= 500 &&
      /[а-яё]/iu.test(address) &&
      /\d/u.test(address) &&
      !address.includes('@')
    ) {
      const key = addressKey(address);
      if (!addresses.has(key)) addresses.set(key, address);
    }
  }
  return [...addresses.values()].slice(0, 6);
}

export async function findArbitrationCourt(
  input: string,
  signal: AbortSignal,
  fetchPage: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<CourtLookup> {
  const territory = courtTerritorySchema.parse(input);
  const base = {
    catalogueUrl: cataloguePage,
    checkedAt: new Date().toISOString(),
  };
  const request = async (url: string) => {
    const response = await fetchPage(url, {
      redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    });
    if (!response.ok) throw new Error('OFFICIAL_COURT_SOURCE_UNAVAILABLE');
    return response;
  };
  try {
    const catalogue = catalogueSchema.parse(
      await (await request(catalogueUrl)).json(),
    );
    const matches = catalogue
      .flatMap(({ ac1 }) => ac1)
      .filter((entry) => territoryMatches(territory, entry));
    if (!matches.length) return { ...base, status: 'not_found', courts: [] };
    const courts = await Promise.all(
      matches.slice(0, 6).flatMap(({ name, url }) => {
        const contactUrl = courtContactUrl(url);
        if (!contactUrl) return [];
        return [
          request(contactUrl)
            .then(async (response) =>
              contactAddresses(
                await response.text(),
                name.startsWith('Постоянное судебное присутствие '),
              ),
            )
            .catch(() => {
              signal.throwIfAborted();
              return [];
            })
            .then((addresses) => ({ name, addresses, contactUrl })),
        ];
      }),
    );
    const status =
      matches.length > 1 || courts.some(({ addresses }) => addresses.length > 1)
        ? 'ambiguous'
        : courts[0]?.addresses.length
          ? 'found'
          : 'unavailable';
    return { ...base, status, courts };
  } catch {
    signal.throwIfAborted();
    return { ...base, status: 'unavailable', courts: [] };
  }
}
