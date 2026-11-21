import { formatBankruptcyMoney } from './bankruptcy-format';
import { canonicalMoneyAmount } from './money';
import { comparableText } from './text-value';

type Row = Record<string, string | null>;
type Values = Partial<Record<string, string | Row[] | null>>;

const inventoryGroups = {
  realEstate: ['land', 'houses', 'apartments', 'garages', 'otherRealEstate'],
  vehicles: [
    'cars',
    'trucks',
    'motorcycles',
    'farmVehicles',
    'boats',
    'aircraft',
    'otherVehicles',
  ],
  valuables: ['cash', 'jewellery', 'art', 'professional', 'otherValuables'],
} as const;

const patterns = {
  land: /земельн[а-яё]* участ/u,
  houses: /жил[а-яё]* дом|дач/u,
  apartments: /квартир/u,
  garages: /гараж/u,
  cars: /легков[а-яё]* автомобил/u,
  trucks: /грузов[а-яё]* автомобил|грузовик/u,
  motorcycles: /мотоцикл|мототранспорт/u,
  farmVehicles: /сельскохозяйствен|сельхозтехник|трактор|комбайн/u,
  boats: /водн[а-яё]* транспорт|катер|лодк/u,
  aircraft: /воздушн[а-яё]* транспорт|самол[её]т|вертол[её]т/u,
  cash: /наличн[а-яё]* (?:денежн[а-яё]* |ден[еь]г[а-яё]*|средств)/u,
  jewellery: /драгоценност|ювелирн|предмет[а-яё]* роскоши/u,
  art: /предмет[а-яё]* искусства|картина/u,
  professional: /профессиональн[а-яё]* занят/u,
};

export const inventorySectionKeys = [
  ...inventoryGroups.realEstate,
  ...inventoryGroups.vehicles,
  'bankAccounts',
  'companyEquity',
  'otherSecurities',
  ...inventoryGroups.valuables,
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
  if (version !== 'bfl-inventory-v2') return undefined;
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
  for (const [field, groups] of Object.entries(inventoryGroups)) {
    for (const row of rows(values[field])) {
      const description = comparableText(row.category || row.description || '');
      const key =
        groups.find(
          (group) =>
            Object.hasOwn(patterns, group) &&
            patterns[group as keyof typeof patterns].test(description),
        ) ?? groups.at(-1);
      if (key)
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
  return Object.fromEntries(
    inventorySectionKeys.map((key) => {
      const section = sections[key];
      return [
        key,
        (section?.length ? section : [{}]).map((row, index) => ({
          ...Object.fromEntries(
            cellKeys.map((cell) => [cell, inventoryCell(row, cell)]),
          ),
          rowNumber: section?.length ? String(index + 1) : '-',
        })),
      ];
    }),
  );
}
