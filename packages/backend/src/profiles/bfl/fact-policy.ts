import { formatPreviousNames } from '@anyko/document-values/bankruptcy-projection';

import type { FactPolicy } from '../fact-policy';

import {
  automaticValue,
  debtSourceChecks,
  evidencedContract,
  valueWithRemainingEvidence,
} from './automatic-value';
import { fieldIdentity } from './fields';
import { isKnownObligationType } from './obligation-type';
import { russianPassportCitation } from './passport-evidence';
import {
  containsObligations,
  fillsObligationType,
  hasUnknownObligationType,
  reconcileObligations,
  supersedesObligation,
  usesBankObligations,
} from './reconcile-obligations';

export const bflFactPolicy: FactPolicy = {
  automaticValue,
  valueWithRemainingEvidence,
  identity: fieldIdentity,
  sourceChecks: debtSourceChecks,
  passportCitation: russianPassportCitation,
  comparableText: (key, value) =>
    key === 'previousNames' ? formatPreviousNames(value) : value,
  employmentIncomeField: 'employmentIncome',
  citizenshipField: 'citizenship',
  previousNamesField: 'previousNames',
  obligations: {
    uses: usesBankObligations,
    reconcile: reconcileObligations,
    contains: containsObligations,
    fillsType: fillsObligationType,
    supersedes: supersedesObligation,
    hasUnknownType: hasUnknownObligationType,
    knownType: isKnownObligationType,
    evidencedContract,
  },
};
