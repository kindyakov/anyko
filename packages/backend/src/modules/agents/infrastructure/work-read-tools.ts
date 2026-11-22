import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  assessEmployment,
  hasEmploymentFields,
} from '@anyko/document-values/employment';

import type { WorkReadContext } from '..';
import { fieldKeySchema } from '../../../profiles/bfl/fields';

import type { encodeModelFieldValue } from './model-field-value';

const defaultMaxReads = 24;
const readLimitResponse = { status: 'read_limit_reached' } as const;
const readLimitSchema = z.object({
  status: z.literal(readLimitResponse.status),
});
const textPageSchema = z.object({
  text: z.string(),
  nextOffset: z.number().nullable(),
});

export function createWorkReadTools(
  input: WorkReadContext & {
    signal: AbortSignal;
    pageCharacters: number;
    maxReads?: number | undefined;
    reserveRead?(limit: number): Promise<boolean>;
    documents: { id: string; filename?: string; images?: string[] }[];
    listSourceMetadata?: boolean;
    listSourceImages?(documentId: string): Promise<string[]>;
    encodeValue?: typeof encodeModelFieldValue;
  },
) {
  const { signal } = input;
  const maxReads = input.maxReads ?? defaultMaxReads;
  let reads = 0;
  let denied = false;
  const readLimitReached = () => reads >= maxReads;
  const withHistory = async <T>(
    tool: string,
    args: object,
    execute: () => Promise<T>,
  ) => {
    const payload = JSON.stringify({ tool, arguments: args });
    let result: T | typeof readLimitResponse;
    try {
      signal.throwIfAborted();
      await input.assertCurrent();
      const allowed = input.reserveRead
        ? await input.reserveRead(maxReads)
        : !readLimitReached();
      if (allowed) reads++;
      else denied = true;
      result = allowed ? await execute() : readLimitResponse;
    } catch (error) {
      await input.traceTool?.({
        input: payload,
        output: null,
        status: 'failed',
        errorCode: 'TOOL_FAILED',
      });
      throw error;
    }
    await input.traceTool?.({
      input: payload,
      output: JSON.stringify(result),
      ...(result === readLimitResponse
        ? { status: 'failed', errorCode: 'CONTEXT_TOOL_LIMIT' }
        : { status: 'succeeded' }),
    });
    return result;
  };
  const readField = createTool({
    id: 'read-work-field',
    description:
      'Прочитать актуальное поле работы, ручное решение и кандидаты. Большие значения читать по nextOffset.',
    inputSchema: z.object({
      field: fieldKeySchema,
      offset: z.number().int().min(0).max(2_000_000).default(0),
    }),
    outputSchema: z.union([textPageSchema, readLimitSchema]),
    execute: ({ field, offset }) =>
      withHistory('read-work-field', { field, offset }, async () => {
        const definition = input.fields.find(({ key }) => key === field);
        if (!definition) throw new Error('FIELD_NOT_ALLOWED');
        const facts = (await input.currentFacts?.()) ?? input.facts;
        const { encodeValue } = input;
        const candidatesForField = (candidates: typeof input.candidates) =>
          candidates
            .filter((candidate) => candidate.field === field)
            .map((candidate) =>
              encodeValue
                ? {
                    ...candidate,
                    value: encodeValue(candidate.value, definition),
                  }
                : candidate,
            );
        const text = JSON.stringify({
          definition,
          value: encodeValue
            ? encodeValue(facts.values[field], definition)
            : facts.values[field],
          manual: facts.manual.includes(field),
          confirmed: facts.confirmed.includes(field),
          ...(field === 'employmentIncome' &&
            hasEmploymentFields(input.fields) && {
              employment: assessEmployment(
                facts.values,
                undefined,
                facts.needsReview,
              ),
            }),
          candidates: candidatesForField(input.candidates),
          savedCandidates: candidatesForField(facts.candidates),
        });
        const end = Math.min(text.length, offset + input.pageCharacters);
        return {
          text: text.slice(offset, end),
          nextOffset: end < text.length ? end : null,
        };
      }),
  });
  const readSource = createTool({
    id: 'read-work-source',
    description:
      'Прочитать текст или описание изображения только разрешённого исходника. Для imagePath=null читается текст; иначе точный путь изображения.',
    inputSchema: z.object({
      documentId: z.uuid(),
      imagePath: z.string().max(240).nullable().default(null),
      offset: z.number().int().min(0).max(2_000_000).default(0),
    }),
    outputSchema: z.union([textPageSchema, readLimitSchema]),
    execute: ({ documentId, imagePath, offset }) =>
      withHistory(
        'read-work-source',
        { documentId, imagePath, offset },
        async () => {
          const source = await input.readSource(documentId, imagePath);
          const end = Math.min(source.length, offset + input.pageCharacters);
          return {
            text: source.slice(offset, end),
            nextOffset: end < source.length ? end : null,
          };
        },
      ),
  });
  const listImages = createTool({
    id: 'list-work-source-images',
    description:
      'Узнать имя разрешённого исходника и точные пути его изображений для readSource. Остальные пути читать по nextOffset.',
    inputSchema: z.object({
      documentId: z.uuid(),
      offset: z.number().int().nonnegative().default(0),
    }),
    outputSchema: z.union([
      z.object({
        filename: z.string().nullable(),
        paths: z.array(z.string()),
        nextOffset: z.number().nullable(),
      }),
      readLimitSchema,
    ]),
    execute: ({ documentId, offset }) =>
      withHistory(
        'list-work-source-images',
        { documentId, offset },
        async () => {
          const document = input.documents.find(({ id }) => id === documentId);
          if (!document) throw new Error('SOURCE_NOT_ALLOWED');
          const images =
            (await input.listSourceImages?.(documentId)) ??
            document.images ??
            [];
          const pageSize = Math.max(1, Math.floor(input.pageCharacters / 250));
          const end = Math.min(images.length, offset + pageSize);
          return {
            filename: document.filename ?? null,
            paths: images.slice(offset, end),
            nextOffset: end < images.length ? end : null,
          };
        },
      ),
  });
  return {
    readLimitReached,
    readLimitExceeded: () => denied,
    tools: {
      readField,
      readSource,
      ...((input.listSourceMetadata ||
        input.documents.some(({ images }) => images?.length)) && {
        listImages,
      }),
    },
  };
}
