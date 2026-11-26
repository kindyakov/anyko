import { prepareTemplate } from '@anyko/document-values/template-filling';

import {
  type DocumentPackage,
  knownPackages,
} from '../../src/modules/templates';
import { fieldDefinitions } from '../../src/profiles/bfl/fields';
import type { FieldValues } from '../../src/profiles/fields';

export function templateData(
  values: FieldValues,
  version = 'bfl-statement-v11',
  placeholders: Readonly<
    NonNullable<DocumentPackage['documents'][number]['placeholders']>
  > = [],
  context?: {
    fields: readonly { key: string; columns?: readonly { key: string }[] }[];
    referenceDate: string;
  },
) {
  const document = knownPackages
    .flatMap(({ documents }) => documents)
    .find((entry) => entry.version === version);
  if (!document) throw new Error('Missing fixture template');
  const fields = fieldDefinitions
    .filter(
      ({ key }) =>
        context || !['employmentHistory', 'employmentIncome'].includes(key),
    )
    .map((field) =>
      field.key === 'realEstate'
        ? {
            ...field,
            columns: field.columns.filter(
              ({ key }) =>
                key !== 'identifier' ||
                context?.fields.some(
                  ({ key, columns }) =>
                    key === 'realEstate' &&
                    columns?.some(({ key }) => key === 'identifier'),
                ),
            ),
          }
        : field,
    );
  const { scalars, repeating } = prepareTemplate(
    { ...document, fields, placeholders },
    values,
    { referenceDate: context?.referenceDate ?? '' },
  );
  const output: FieldValues = { ...scalars, ...repeating };
  return output;
}
