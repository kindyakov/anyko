import type { z } from 'zod';

import type { FactSourceText } from './agent-policy';
import type { candidateSchema } from './candidate';
import type { FieldDefinition, FieldRow, FieldValue } from './fields';

type Candidate = z.infer<typeof candidateSchema>;
export interface SourceChecks {
  hasNewerBalance(row: FieldRow): boolean;
  supportsBalance(row: FieldRow, evidence: Candidate['evidence']): boolean;
}

export interface FactPolicy {
  automaticValue?(
    candidate: Candidate,
    context?: {
      sources?: readonly FactSourceText[] | undefined;
      definition?: FieldDefinition | undefined;
    },
  ): FieldValue;
  valueWithRemainingEvidence?(
    candidate: Candidate,
    definition: FieldDefinition,
  ): FieldValue;
  identity?(key: string): readonly string[];
  sourceChecks?(sources: readonly FactSourceText[]): SourceChecks;
  passportCitation?: (text: string) => string | undefined;
  comparableText?(key: string, value: string): string;
  employmentIncomeField?: string;
  citizenshipField?: string;
  previousNamesField?: string;
  obligations?: {
    uses(key: string, values: FieldValue[]): boolean;
    reconcile(
      saved: FieldValue,
      found: Candidate[],
      checks: SourceChecks | undefined,
      sources: readonly FactSourceText[] | undefined,
    ): { value: FieldValue; missingCurrentBalance: boolean };
    contains(saved: FieldValue, proposed: FieldValue): boolean;
    fillsType(row: FieldRow, old: FieldRow): boolean;
    supersedes(row: FieldRow, old: FieldRow): boolean;
    hasUnknownType(value: FieldValue): boolean;
    knownType(value: FieldRow[string] | undefined): boolean;
    evidencedContract(
      evidence: Candidate['evidence'],
      row: FieldRow,
    ): { identity: FieldRow } | undefined;
  };
}
