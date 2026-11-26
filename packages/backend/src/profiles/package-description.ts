import type { AnalysisPlan } from './analysis-plan';
import type { DocumentPackage } from './template-schema';

interface SourceRequirement {
  key: string;
  documentKind: string;
  label: string;
  applicability: 'usual' | 'conditional';
  position: number;
}

export interface PackageDescription {
  package: DocumentPackage;
  requirements: Readonly<Record<string, readonly SourceRequirement[]>>;
  catalogTitles?:
    | {
        package: string;
        templates: Readonly<Record<string, string>>;
      }
    | undefined;
  analysis: {
    excludedFields: readonly string[];
    plan?: AnalysisPlan | undefined;
    instructions?:
      | {
          extraction: string;
          reconciliation: string;
          reconciliationWithChecklist: string;
          chat: string;
        }
      | undefined;
  };
}

export interface PackagePublication extends PackageDescription {
  profile: { id: string; revision: string };
  scope?: 'production' | 'retained' | 'internal' | undefined;
}
