import { formatBankruptcyMoney } from './bankruptcy-format';
import { canonicalMoneyAmount } from './money';
import { missingTemplateValue } from './template-value';
import { comparableText } from './text-value';

type Row = Record<string, string | null>;
type Values = Partial<Record<string, string | Row[] | null>>;

export const inventoryCategories = {
  realEstate: {
    'земельный участок': 'land',
    'жилой дом': 'houses',
    квартира: 'apartments',
    гараж: 'garages',
    иное: 'otherRealEstate',
  },
  vehicles: {
    'легковой автомобиль': 'cars',
    'грузовой автомобиль': 'trucks',
    мототранспорт: 'motorcycles',
    сельхозтехника: 'farmVehicles',
    водный: 'boats',
    воздушный: 'aircraft',
    иной: 'otherVehicles',
  },
  valuables: {
    драгоценности: 'jewellery',
    'предметы искусства': 'art',
    'имущество для профессиональных занятий': 'professional',
    иное: 'otherValuables',
  },
} as const;

export const inventorySectionKeys = [
  ...Object.values(inventoryCategories.realEstate),
  ...Object.values(inventoryCategories.vehicles),
  'bankAccounts',
  'companyEquity',
  'otherSecurities',
  'cash',
  ...Object.values(inventoryCategories.valuables),
] as const;
const cellKeys = [
  'description',
  'ownership',
  'address',
  'area',
  'basis',
  'pledge',
  'identifier',
  'amount',
  'name',
  'type',
  'openedAt',
  'share',
  'nominal',
  'quantity',
];

function inventoryCell(row: Row, cell: string) {
  const value = row[cell]?.trim();
  if (!value) return '-';
  const amount =
    cell === 'amount' || cell === 'nominal'
      ? canonicalMoneyAmount(value)
      : undefined;
  return amount && !/\p{L}/u.test(value)
    ? formatBankruptcyMoney(amount)
    : value;
}

export function inventorySections(
  version: string | undefined,
  values: Values,
  fields: readonly { key: string; columns?: readonly { key: string }[] }[] = [],
) {
  if (version !== 'inventory') return undefined;
  const includeCadastralNumber = fields.some(
    ({ key, columns }) =>
      key === 'realEstate' && columns?.some(({ key }) => key === 'identifier'),
  );
  const sections: Record<string, Row[]> = Object.fromEntries(
    inventorySectionKeys.map((key) => [key, []]),
  );
  const rows = (value: Values[string]) =>
    Array.isArray(value)
      ? value.filter((row) => Object.values(row).some(Boolean))
      : [];
  const unknown = new Set<string>();
  const unclassified = new Map<string, string[]>();
  for (const [field, categories] of Object.entries(inventoryCategories)) {
    const choices = new Map<string, string>(Object.entries(categories));
    const value = values[field];
    const supplied = rows(value);
    if (
      !Array.isArray(value) ||
      supplied.some(
        ({ category }) => !choices.has(comparableText(category ?? '')),
      )
    )
      for (const key of choices.values()) unknown.add(key);
    for (const row of supplied) {
      const key = choices.get(comparableText(row.category ?? ''));
      if (!key) {
        const section = [...choices.values()].at(-1);
        if (section) {
          const captions = unclassified.get(section) ?? [];
          captions.push(
            [row.description, row.address, row.identifier]
              .filter(Boolean)
              .join(', ') || missingTemplateValue,
          );
          unclassified.set(section, captions);
        }
        continue;
      }
      sections[key]?.push(
        includeCadastralNumber &&
          field === 'realEstate' &&
          row.identifier &&
          !row.description?.includes(row.identifier)
          ? {
              ...row,
              description: [
                row.description,
                `кадастровый номер ${row.identifier}`,
              ]
                .filter(Boolean)
                .join(', '),
            }
          : row,
      );
    }
  }
  sections.bankAccounts = rows(values.accounts);
  sections.companyEquity = rows(values.equity);
  sections.otherSecurities = rows(values.securities);
  const cash =
    typeof values.cashOnHand === 'string'
      ? canonicalMoneyAmount(values.cashOnHand)
      : undefined;
  if (cash !== undefined)
    sections.cash = [
      {
        description: 'Наличные денежные средства',
        amount: formatBankruptcyMoney(cash) + ' руб.',
      },
    ];
  if (cash === undefined) unknown.add('cash');
  for (const [field, section] of [
    ['accounts', 'bankAccounts'],
    ['equity', 'companyEquity'],
    ['securities', 'otherSecurities'],
  ] as const)
    if (!Array.isArray(values[field])) unknown.add(section);
  return Object.fromEntries(
    inventorySectionKeys.map((key) => {
      const section = sections[key];
      return [
        key,
        (section?.length
          ? section
          : [
              {
                [key === 'bankAccounts' || key === 'companyEquity'
                  ? 'name'
                  : key === 'otherSecurities'
                    ? 'type'
                    : 'description']: unknown.has(key)
                  ? missingTemplateValue
                  : null,
              },
            ]
        )
          .concat(
            (unclassified.get(key) ?? []).map((description) => ({
              description: '[уточните подраздел описи] ' + description,
            })),
          )
          .map((row, index) => ({
            ...Object.fromEntries(
              cellKeys.map((cell) => [cell, inventoryCell(row, cell)]),
            ),
            rowNumber: section?.length ? String(index + 1) : '-',
          })),
      ];
    }),
  );
}
