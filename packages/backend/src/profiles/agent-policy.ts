import type { z } from 'zod';

import type { candidateSchema } from './candidate';
import type { FieldDefinition, FieldKey } from './fields';

export interface FactSourceText {
  documentId: string;
  text: string;
}

export interface CourtEvidence {
  name: FieldKey;
  address: FieldKey;
  region: FieldKey;
  addresses: readonly FieldKey[];
}

export interface CreditorEvidence {
  fields: readonly FieldKey[];
  primaryRegistry: 'cbr' | 'fns';
  fallbackRegistry: 'cbr' | 'fns';
}

interface AgentLookups {
  court?: CourtEvidence;
  creditor?: CreditorEvidence;
}

type Candidate = z.infer<typeof candidateSchema>;

export interface AgentPolicy {
  extraction?: (fields: readonly FieldDefinition[]) => string;
  reconciliation?: (
    fields: readonly FieldDefinition[],
    withChecklist: boolean,
  ) => string;
  chat?: (fields: readonly FieldDefinition[]) => string;
  modelFields?: {
    serverFields: readonly FieldKey[];
    serverColumns: readonly string[];
  };
  lookups?: {
    reconciliation: AgentLookups;
    chat: AgentLookups;
    steps: Readonly<Partial<Record<string, AgentLookups>>>;
  };
  courtInferenceFields?: readonly FieldKey[];
  stepEvidence?: {
    revision: string;
    needsSourceText(candidate: Candidate): boolean;
    rejection(
      candidate: Candidate,
      sources: readonly FactSourceText[],
    ): string | undefined;
  };
}
