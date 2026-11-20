import type {
  FieldKey,
  FieldValue,
  FieldValues,
} from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';

import { sameFieldValue } from './field-value';

type Candidate = WorkView['facts']['candidates'][number];
type CourtSource = NonNullable<Candidate['courtSources']>;

export function courtOptions(
  current: FieldValues,
  candidates: Candidate[],
  field: FieldKey,
  value: FieldValue,
  sources: Iterable<CourtSource>,
) {
  const options = new Map<
    string,
    { courtName: string; courtAddress: string | null }
  >();
  for (const source of sources) {
    const samePage = candidates.filter(
      ({ courtSources }) => courtSources?.contactUrl === source.contactUrl,
    );
    const names = new Set(
      samePage.flatMap((candidate) =>
        candidate.field === 'courtName' && typeof candidate.value === 'string'
          ? [candidate.value]
          : [],
      ),
    );
    const courtName =
      source.courtName ??
      (field === 'courtName' && typeof value === 'string'
        ? value
        : undefined) ??
      (names.size === 1 ? [...names][0] : undefined);
    if (!courtName) continue;

    const addresses =
      field === 'courtAddress' && typeof value === 'string'
        ? [value]
        : samePage.flatMap((candidate) =>
            candidate.field === 'courtAddress' &&
            typeof candidate.value === 'string' &&
            (candidate.courtSources?.courtName === courtName ||
              (!candidate.courtSources?.courtName && names.size === 1))
              ? [candidate.value]
              : [],
          );
    for (const courtAddress of addresses.length ? addresses : [null]) {
      options.set(JSON.stringify([courtName, courtAddress]), {
        courtName,
        courtAddress,
      });
    }
  }
  return [...options.values()].filter(
    ({ courtName, courtAddress }) =>
      !sameFieldValue(current.courtName, courtName) ||
      (courtAddress !== null &&
        !sameFieldValue(current.courtAddress, courtAddress)),
  );
}
