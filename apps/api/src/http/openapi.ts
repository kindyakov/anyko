import { z } from 'zod';

import {
  type Endpoint,
  errorCodeSchema,
  httpErrorSchema,
} from '@anyko/contracts/common';

// OpenAPI строится из endpoint-описаний, без отдельного файла, который можно разойти с кодом.
// Схемы берутся через z.toJSONSchema (Zod 4); преобразования и файлы описываются как any.
type Json = Record<string, unknown>;

const jsonSchema = (schema: z.ZodType, io: 'input' | 'output'): Json => {
  const generated = z.toJSONSchema(schema, { io, unrepresentable: 'any' });
  // Ключ draft нужен только самой JSON Schema; внутри OpenAPI он лишний.
  return Object.fromEntries(
    Object.entries(generated).filter(([key]) => key !== '$schema'),
  );
};

const parameters = (endpoint: Endpoint): Json[] => {
  const groups = [
    ['path', endpoint.params],
    ['query', endpoint.query],
    ['header', endpoint.headers],
  ] as const;
  return groups.flatMap(([location, schema]) => {
    if (!schema) return [];
    const { properties = {}, required = [] } = jsonSchema(schema, 'input') as {
      properties?: Record<string, Json>;
      required?: string[];
    };
    return Object.entries(properties).map(([name, value]) => ({
      name,
      in: location,
      required: location === 'path' || required.includes(name),
      schema: value,
    }));
  });
};

const requestBody = (endpoint: Endpoint): Json | undefined => {
  const body = endpoint.body;
  if (body?.kind === 'json')
    return {
      required: true,
      content: {
        'application/json': { schema: jsonSchema(body.schema, 'input') },
      },
    };
  if (body?.kind === 'multipart')
    return {
      required: true,
      content: {
        'multipart/form-data': { schema: jsonSchema(body.fields, 'input') },
      },
    };
  return undefined;
};

const successResponse = (endpoint: Endpoint): Json => {
  const response = endpoint.response;
  if (response.kind === 'json')
    return {
      content: {
        'application/json': { schema: jsonSchema(response.schema, 'output') },
      },
    };
  if (response.kind === 'events')
    return { content: { 'text/event-stream': {} } };
  return { content: { 'application/octet-stream': {} } };
};

function operation(endpoint: Endpoint): Json {
  const body = requestBody(endpoint);
  return {
    summary: endpoint.summary,
    parameters: parameters(endpoint),
    ...(body ? { requestBody: body } : {}),
    responses: {
      [String(endpoint.status)]: {
        description: 'Успех',
        ...successResponse(endpoint),
      },
      default: {
        description: 'Ошибка',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/HttpError' },
          },
        },
      },
    },
    // Коды ошибок, которые endpoint может вернуть сверх общих (UNAUTHORIZED и т. п.).
    'x-error-codes': endpoint.errors,
    ...(endpoint.idempotency === undefined
      ? {}
      : { 'x-idempotency': endpoint.idempotency }),
  };
}

export function buildOpenApi(endpoints: readonly Endpoint[]) {
  const paths: Record<string, Record<string, Json>> = {};
  for (const endpoint of endpoints) {
    const path = `/api/v1${endpoint.path.replaceAll(/:(\w+)/g, '{$1}')}`;
    paths[path] = {
      ...paths[path],
      [endpoint.method.toLowerCase()]: operation(endpoint),
    };
  }
  return {
    openapi: '3.1.0',
    info: { title: 'Anyko API', version: 'v1' },
    paths,
    components: {
      schemas: {
        HttpError: jsonSchema(httpErrorSchema, 'output'),
        ErrorCode: jsonSchema(errorCodeSchema, 'output'),
      },
    },
  };
}
