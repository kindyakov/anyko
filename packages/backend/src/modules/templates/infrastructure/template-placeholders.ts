import type { Database } from '@anyko/database';

import { type DocumentPackage, templatePlaceholderSchema } from '../schemas';

export function createTemplatePlaceholders(db: Database) {
  return async (pack: DocumentPackage): Promise<DocumentPackage> => {
    const placeholders = await db.documentTemplatePlaceholder.findMany({
      where: {
        templateVersion: { in: pack.documents.map(({ version }) => version) },
      },
      orderBy: { tag: 'asc' },
    });
    return {
      ...pack,
      documents: pack.documents.map((document) => ({
        ...document,
        placeholders: placeholders
          .filter(({ templateVersion }) => templateVersion === document.version)
          .map((slot) => templatePlaceholderSchema.parse(slot)),
      })),
    };
  };
}
