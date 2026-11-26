import { prepareTemplate } from '@anyko/document-values/template-filling';
import { DiagnosticError } from '@anyko/logger';

import type {
  DocumentPackage,
  ReadTemplateRequirements,
} from '../modules/templates';
import { technicalDescription } from '../modules/templates';
import type { AgentPolicy } from '../profiles/agent-policy';
import { bflAgentPolicy } from '../profiles/bfl/agent-policy';
import { bflFactPolicy } from '../profiles/bfl/fact-policy';
import { bflPackageDescriptions } from '../profiles/bfl/package-descriptions';
import type { FactPolicy } from '../profiles/fact-policy';
import type {
  PackageDescription,
  PackagePublication,
} from '../profiles/package-description';
import type { WorkAnalysisDefinition } from '../workflows/work-analysis/definition';
import type {
  ResolveWorkPackage,
  WorkPackage,
} from '../workflows/work-package';

import { templateBytes } from './template-assets';

export interface ProcessingProfile {
  id: string;
  revision: string;
  packages: readonly PackageDescription[];
  factPolicy?: FactPolicy;
  fillingFunctions?: readonly NonNullable<
    DocumentPackage['documents'][number]['filling']
  >['functionId'][];
  agentPolicy?: AgentPolicy;
  templateBytes: WorkPackage['templateBytes'];
}

export function createProcessingProfiles(
  stepwise: boolean,
  additional: readonly ProcessingProfile[] = [],
): {
  has: (version: string) => boolean;
  resolve: ResolveWorkPackage;
  publications: PackagePublication[];
  requirements: ReadTemplateRequirements;
} {
  const profiles: readonly ProcessingProfile[] = [
    {
      id: 'bfl-bankruptcy',
      revision: '1',
      packages: bflPackageDescriptions,
      factPolicy: bflFactPolicy,
      fillingFunctions: ['bfl-v1'],
      agentPolicy: bflAgentPolicy,
      templateBytes,
    },
    {
      id: 'technical-document',
      revision: '1',
      packages: [technicalDescription],
      templateBytes,
    },
    ...additional,
  ];
  const registered = new Set<string>();
  const packages = new Map<string, WorkPackage>();
  const publications: PackagePublication[] = [];
  const requirements = new Map<
    string,
    Awaited<ReturnType<ReadTemplateRequirements>>
  >();
  for (const profile of profiles) {
    const identity = JSON.stringify([profile.id, profile.revision]);
    if (registered.has(identity))
      throw new Error('DUPLICATE_PROCESSING_PROFILE');
    registered.add(identity);
    for (const description of profile.packages) {
      const pack = description.package;
      if (
        pack.documents.some(
          ({ filling }) =>
            filling && !profile.fillingFunctions?.includes(filling.functionId),
        )
      )
        throw new Error('UNREGISTERED_FILLING_FUNCTION');
      if (packages.has(pack.version))
        throw new Error('DUPLICATE_PACKAGE_VERSION');
      if (
        new Set(pack.fields.map(({ key }) => key)).size !== pack.fields.length
      )
        throw new Error('DUPLICATE_PACKAGE_FIELD');
      const profileRef = { id: profile.id, revision: profile.revision };
      publications.push({ ...description, profile: profileRef });
      const merged = new Map<
        string,
        Awaited<ReturnType<ReadTemplateRequirements>>[number]
      >();
      for (const document of pack.documents) {
        for (const { key, documentKind, label, applicability } of [
          ...(description.requirements[document.version] ?? []),
        ].sort((a, b) => a.position - b.position)) {
          if (!merged.has(key))
            merged.set(key, { key, documentKind, label, applicability });
        }
      }
      requirements.set(pack.version, [...merged.values()]);
      packages.set(pack.version, {
        profile: profileRef,
        description: pack,
        factPolicy: profile.factPolicy,
        analysis: resolveAnalysis(description, stepwise, profile.agentPolicy),
        templateBytes(version) {
          if (!pack.documents.some((template) => template.version === version))
            throw new Error('UNREGISTERED_PACKAGE_TEMPLATE');
          return profile.templateBytes(version);
        },
        templateData(values, template, referenceDate) {
          const { scalars, repeating } = prepareTemplate(
            {
              ...template,
              fields: pack.fields,
              attachments: pack.attachments ?? [],
            },
            values,
            { referenceDate },
          );
          return { ...scalars, ...repeating };
        },
      });
    }
  }
  return {
    publications,
    requirements: (version) => Promise.resolve(requirements.get(version) ?? []),
    has: (version) => packages.has(version),
    resolve(version) {
      const pack = packages.get(version);
      if (!pack)
        throw new DiagnosticError({
          code: 'PACKAGE_NOT_FOUND',
          message: 'Версия пакета документов отсутствует в каталоге.',
          operation: 'templates.requirePackage',
        });
      return pack;
    },
  };
}

function resolveAnalysis(
  description: PackageDescription,
  stepwise: boolean,
  policy: AgentPolicy = {},
): WorkAnalysisDefinition {
  const { excludedFields, plan, instructions } = description.analysis;
  const excluded = new Set(excludedFields);
  const fields = description.package.fields.filter(
    ({ key }) => !excluded.has(key),
  );
  return {
    fields,
    excludedFields: excluded.size ? excluded : undefined,
    plan: stepwise ? plan : undefined,
    policy: instructions
      ? {
          ...policy,
          // The model can extract different field subsets, such as one document
          // shard. Preserve the profile's field-dependent instructions for them.
          extraction: (available) =>
            policy.extraction &&
            (available.length !== fields.length ||
              available.some(({ key }, index) => key !== fields[index]?.key))
              ? policy.extraction(available)
              : instructions.extraction,
          reconciliation: (_available, checklist) =>
            checklist
              ? instructions.reconciliationWithChecklist
              : instructions.reconciliation,
          chat: () => instructions.chat,
        }
      : policy,
  };
}
