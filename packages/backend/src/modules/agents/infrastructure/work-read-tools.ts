import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { WorkReadContext } from '..';
import { fieldKeySchema } from '../../../profiles/bfl/fields';

export function createWorkReadTools(
  input: WorkReadContext & {
    signal: AbortSignal;
    pageCharacters: number;
    documents: { id: string; filename?: string; images?: string[] }[];
    listSourceMetadata?: boolean;
    listSourceImages?(documentId: string): Promise<string[]>;
  },
) {
  const { signal } = input;
  let reads = 0;
  const withHistory = async <T>(
    tool: string,
    args: object,
    execute: () => Promise<T>,
  ) => {
    const payload = JSON.stringify({ tool, arguments: args });
    let result: T;
    try {
      result = await execute();
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
      status: 'succeeded',
    });
    return result;
  };
  const check = async () => {
    signal.throwIfAborted();
    if (++reads > 24) throw new Error('CONTEXT_TOOL_LIMIT');
    await input.assertCurrent();
  };
  const readField = createTool({
    id: 'read-work-field',
    description:
      'Прочитать актуальное поле работы, ручное решение и кандидаты. Большие значения читать по nextOffset.',
    inputSchema: z.object({
      field: fieldKeySchema,
      offset: z.number().int().min(0).max(2_000_000).default(0),
    }),
    outputSchema: z.object({
      text: z.string(),
      nextOffset: z.number().nullable(),
    }),
    execute: ({ field, offset }) =>
      withHistory('read-work-field', { field, offset }, async () => {
        await check();
        const definition = input.fields.find(({ key }) => key === field);
        if (!definition) throw new Error('FIELD_NOT_ALLOWED');
        const facts = (await input.currentFacts?.()) ?? input.facts;
        const text = JSON.stringify({
          definition,
          value: facts.values[field],
          manual: facts.manual.includes(field),
          confirmed: facts.confirmed.includes(field),
          candidates: input.candidates.filter((c) => c.field === field),
          savedCandidates: facts.candidates.filter((c) => c.field === field),
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
    outputSchema: z.object({
      text: z.string(),
      nextOffset: z.number().nullable(),
    }),
    execute: ({ documentId, imagePath, offset }) =>
      withHistory(
        'read-work-source',
        { documentId, imagePath, offset },
        async () => {
          await check();
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
    outputSchema: z.object({
      filename: z.string().nullable(),
      paths: z.array(z.string()),
      nextOffset: z.number().nullable(),
    }),
    execute: ({ documentId, offset }) =>
      withHistory(
        'list-work-source-images',
        { documentId, offset },
        async () => {
          await check();
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
    readField,
    readSource,
    ...((input.listSourceMetadata ||
      input.documents.some(({ images }) => images?.length)) && { listImages }),
  };
}
