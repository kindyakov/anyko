import { expect, test } from 'bun:test';

import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

import { createModelGateway } from '@anyko/llm';

import {
  decodeModelFieldValue,
  decodeReconciliationFieldValue,
  modelFieldValue,
  modelReconciliationFieldValue,
} from './model-field-value';

test('the strict provider schema allows named cells and preserves distinct contract rows', async () => {
  const rows = [
    [
      { column: 'contractNumber', value: 'A-12' },
      { column: 'amount', value: '145006.47' },
    ],
    [
      { column: 'contractNumber', value: 'B-34' },
      { column: 'amount', value: '15993.53' },
    ],
  ];
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
              content: JSON.stringify({ value: rows }),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    },
    { preconnect: fetch.preconnect },
  );
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
    ),
  });
  const schema = z.strictObject({ value: modelFieldValue });
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
          value: {
            anyOf: [
              {
                anyOf: [
                  { type: 'string' },
                  {
                    type: 'array',
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: { column: { type: 'string' }, value: {} },
                        required: ['column', 'value'],
                      },
                    },
                  },
                ],
              },
              { type: 'null' },
            ],
          },
        },
      },
    },
  });
  expect(decodeModelFieldValue(schema.parse(result.object).value)).toEqual([
    { contractNumber: 'A-12', amount: '145006.47' },
    { contractNumber: 'B-34', amount: '15993.53' },
  ]);
});

test('a reconciliation response with unambiguous flattened cells yields one row', () => {
  const amount = { column: 'amount', value: '145006.47' };
  const contract = { column: 'contractNumber', value: 'A-12' };
  expect(
    decodeModelFieldValue(
      modelReconciliationFieldValue.parse([contract, amount]),
    ),
  ).toEqual([{ contractNumber: 'A-12', amount: '145006.47' }]);
  expect(
    decodeModelFieldValue(
      modelReconciliationFieldValue.parse([contract, amount, amount]),
    ),
  ).toBeNull();
  expect(decodeReconciliationFieldValue([{ proof: 'Справка № 5417' }])).toEqual(
    [{ proof: 'Справка № 5417' }],
  );
  expect(decodeReconciliationFieldValue([{}])).toBeNull();
});
