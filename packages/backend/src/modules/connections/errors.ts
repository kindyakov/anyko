import { defineErrors } from '../../platform/errors';
export const ConnectionErrors = defineErrors({
  CONNECTION_REVOKED: 'precondition',
  LLM_NOT_CONFIGURED: 'precondition',
});
