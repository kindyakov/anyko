import { candidateSchema as storedCandidateSchema } from '../candidate';

import { fieldValueIssue } from './fields';

export const candidateSchema = storedCandidateSchema.superRefine(
  ({ field, value }, ctx) => {
    const issue = fieldValueIssue(field, value);
    if (issue)
      ctx.addIssue({ code: 'custom', path: ['value'], message: issue });
  },
);
