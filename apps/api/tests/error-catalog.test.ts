import { expect, test } from 'bun:test';

import { ConnectionErrors } from '@anyko/backend/connections';
import { DocumentErrors } from '@anyko/backend/documents';
import { IdempotencyErrors } from '@anyko/backend/idempotency';
import { WorkErrors } from '@anyko/backend/works';
import { errorCodeSchema } from '@anyko/contracts/common';

import { transportErrorCodes } from '../src/http/errors';

test('error catalog lists exactly the codes the API can return', () => {
  const returned = new Set<string>([
    ...WorkErrors.codes,
    ...ConnectionErrors.codes,
    ...DocumentErrors.codes,
    ...IdempotencyErrors.codes,
    ...Object.values(transportErrorCodes),
  ]);
  expect(new Set<string>(errorCodeSchema.options)).toEqual(returned);
});
