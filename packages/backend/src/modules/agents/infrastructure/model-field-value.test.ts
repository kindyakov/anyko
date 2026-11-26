import { expect, test } from 'bun:test';

import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

import { createModelGateway } from '@anyko/llm';

import { bflAgentPolicy } from '../../../profiles/bfl/agent-policy';
import { fieldDefinitions } from '../../../profiles/bfl/fields';

import {
  decodeModelFieldValue,
  modelCandidateSchema,
  modelFields,
} from './model-field-value';

test('explicit business absence fits the same strict output used by the parser', () => {
  const schema = modelCandidateSchema(
    modelFields(
      fieldDefinitions.filter(({ key }) => key === 'businessDebts'),
      bflAgentPolicy.modelFields,
    ),
    false,
  );
  const candidate = {
    field: 'businessDebts',
    value: [],
    evidence: [
      {
        documentId: '01900000-0000-7000-8000-000000000002',
        imagePath: null,
        quote:
          'Предпринимательской деятельностью не занимался, статуса ИП не имел',
      },
    ],
  };
  expect(decodeModelFieldValue(schema.parse(candidate).value)).toEqual([]);
  expect(z.toJSONSchema(schema)).toMatchObject({
    anyOf: [{ properties: { value: { type: 'array', maxItems: 1 } } }],
  });
  expect(
    schema.safeParse({
      ...candidate,
      evidence: [],
    }).success,
  ).toBe(false);
});

test('the strict provider and candidate parser use one row and document columns for each bank obligation', async () => {
  const fields = modelFields(
    fieldDefinitions.filter(({ key }) => key === 'debts'),
    bflAgentPolicy.modelFields,
  );
  const candidate = {
    field: 'debts' as const,
    origin: 'document' as const,
    explanation: null,
    evidence: [
      {
        documentId: '01900000-0000-7000-8000-000000000002',
        imagePath: null,
        quote: 'Договор № A-12',
      },
    ],
    value: [
      [
        { column: 'contractNumber', value: 'A-12' },
        { column: 'amount', value: '145006.47' },
      ],
    ],
  };
  let responseFormat: unknown;
  const transport = Object.assign(
    async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const body: unknown = await new Request(url, init).json();
      responseFormat = z
        .object({ response_format: z.unknown() })
        .parse(body).response_format;
      return Response.json({
        id: 'fixture',
        object: 'chat.completion',
        model: 'example/model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({ candidates: [candidate] }),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    },
    { preconnect: fetch.preconnect },
  );
  const item = modelCandidateSchema(fields, true);
  const schema = z.strictObject({ candidates: z.array(item) });
  const agent = new Agent({
    id: 'bfl-test',
    name: 'BFL test',
    instructions: 'Extract.',
    model: createModelGateway({ fetch: transport }).model(
      {
        id: 'routerai',
        baseURL: 'https://fixture.invalid/v1',
        apiKey: 'fixture',
      },
      {
        id: 'example/model',
        images: false,
        tools: false,
        structuredOutput: true,
      },
      undefined,
      undefined,
      schema,
    ),
  });
  const result = await agent.generate('Test document', {
    maxSteps: 1,
    structuredOutput: { schema },
  });

  expect(responseFormat).toMatchObject({
    type: 'json_schema',
    json_schema: {
      strict: true,
      schema: {
        properties: {
          candidates: {
            items: {
              anyOf: [
                {
                  properties: {
                    field: { enum: ['debts'] },
                    value: {
                      type: 'array',
                      minItems: 1,
                      maxItems: 1,
                      items: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            column: {
                              enum: fields[0]?.columns.map(({ key }) => key),
                            },
                            value: {},
                          },
                          required: ['column', 'value'],
                          additionalProperties: false,
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  });
  expect(schema.parse(result.object).candidates).toEqual([candidate]);
  expect(decodeModelFieldValue(item.parse(candidate).value)).toEqual([
    { contractNumber: 'A-12', amount: '145006.47' },
  ]);
  for (const column of ['creditorShortName', 'creditorLegalName', 'kpp', 'bic'])
    expect(JSON.stringify(responseFormat)).not.toContain(`"${column}"`);
  for (const value of [
    [{ contractNumber: 'A-12', amount: '145006.47' }],
    [...candidate.value, ...candidate.value],
    [[{ column: 'creditorShortName', value: 'ТБанк' }]],
  ]) {
    expect(item.safeParse({ ...candidate, value }).success).toBe(false);
  }
});
