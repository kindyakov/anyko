import type { Database } from '@anyko/database';
import { DiagnosticError } from '@anyko/logger';

import { type DocumentPackage, templatePlaceholderSchema } from '../schemas';

const databaseFailures = {
  P2021: ['DB_TABLE_MISSING', 'В схеме БД отсутствует таблица полей шаблона.'],
  P2022: [
    'DB_COLUMN_MISSING',
    'В схеме БД отсутствует ожидаемая колонка полей шаблона.',
  ],
} as const;

export function createTemplatePlaceholders(db: Database) {
  return async (pack: DocumentPackage): Promise<DocumentPackage> => {
    const operation = 'templates.readPlaceholders';
    const placeholders = await db.documentTemplatePlaceholder
      .findMany({
        where: {
          templateVersion: { in: pack.documents.map(({ version }) => version) },
        },
        orderBy: { tag: 'asc' },
      })
      .catch((error: unknown) => {
        const prismaCode =
          error instanceof Error &&
          error.name === 'PrismaClientKnownRequestError' &&
          'code' in error
            ? error.code
            : undefined;
        if (prismaCode === 'P2021' || prismaCode === 'P2022') {
          const [code, message] = databaseFailures[prismaCode];
          throw new DiagnosticError(
            { code, message, operation, causeCode: prismaCode },
            { cause: error },
          );
        }
        throw new DiagnosticError(
          {
            code: 'TEMPLATE_PLACEHOLDERS_READ_FAILED',
            message: 'Не удалось прочитать поля шаблона из БД.',
            operation,
          },
          { cause: error },
        );
      });
    return {
      ...pack,
      documents: pack.documents.map((document) => ({
        ...document,
        placeholders: placeholders
          .filter(({ templateVersion }) => templateVersion === document.version)
          .map((slot) => {
            const parsed = templatePlaceholderSchema.safeParse(slot);
            if (!parsed.success) {
              throw new DiagnosticError(
                {
                  code: 'TEMPLATE_PLACEHOLDER_INVALID',
                  message: 'Запись поля шаблона в БД не соответствует схеме.',
                  operation,
                },
                { cause: parsed.error },
              );
            }
            return parsed.data;
          }),
      })),
    };
  };
}
