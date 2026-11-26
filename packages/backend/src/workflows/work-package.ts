import type { DocumentPackage } from '../modules/templates';
import type { FieldValues } from '../profiles/fields';

import type { WorkAnalysisDefinition } from './work-analysis/definition';

export interface WorkPackage {
  profile: { id: string; revision: string };
  description: DocumentPackage;
  analysis: WorkAnalysisDefinition;
  templateBytes(templateVersion: string): Uint8Array;
  templateData(
    values: FieldValues,
    template: DocumentPackage['documents'][number],
    referenceDate: string,
  ): FieldValues;
}

export type ResolveWorkPackage = (version: string) => WorkPackage;
