import {
  isTemplateFilling,
  prepareTemplate,
} from '@anyko/document-values/template-filling';
import { DiagnosticError } from '@anyko/logger';

import type {
  DocumentPackage,
  ReadTemplateRequirements,
} from '../modules/templates';
import { technicalBytes, technicalDescription } from '../modules/templates';
import type { AgentPolicy } from '../profiles/agent-policy';
import { bflAgentPolicy } from '../profiles/bfl/agent-policy';
import { bflFactPolicy } from '../profiles/bfl/fact-policy';
import {
  bflPackageDescriptions,
  defaultBflPackage,
} from '../profiles/bfl/package-descriptions';
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

import { bflTemplateBytes } from './template-assets';

export interface ProcessingProfile {
  id: string;
  revision: string;
  packages: readonly PackageDescription[];
  factPolicy?: FactPolicy;
  fillingFunctions?: readonly NonNullable<
    Parameters<typeof prepareTemplate>[0]['filling']
  >['functionId'][];
  allowsProductionPublication?: boolean;
  agentPolicy?: AgentPolicy;
  templateBytes: WorkPackage['templateBytes'];
}

function registeredProfiles(additional: readonly ProcessingProfile[]) {
  const profiles = [
    {
      id: 'bfl-bankruptcy',
      revision: '1',
      packages: bflPackageDescriptions,
      allowsProductionPublication: true,
      factPolicy: bflFactPolicy,
      fillingFunctions: ['bfl-v1'],
      agentPolicy: bflAgentPolicy,
      templateBytes: bflTemplateBytes,
    },
    {
      id: 'technical-document',
      revision: '1',
      packages: [technicalDescription],
      templateBytes: technicalBytes,
    },
    ...additional,
  ] satisfies readonly ProcessingProfile[];
  const registered = new Map<string, ProcessingProfile>();
  for (const profile of profiles) {
    const identity = profileIdentity(profile);
    if (registered.has(identity))
      throw new Error('DUPLICATE_PROCESSING_PROFILE');
    registered.set(identity, profile);
  }
  return registered;
}

function profileIdentity(profile: { id: string; revision: string }) {
  return JSON.stringify([profile.id, profile.revision]);
}

function publicationScope(description: PackagePublication) {
  const { package: pack } = description;
  if (description.scope) return description.scope;
  // The first release's baseline descriptors did not carry an explicit scope.
  if (pack.technical) return 'internal';
  if (pack.version === defaultBflPackage.package.version) return 'production';
  if (
    bflPackageDescriptions.some(
      (entry) => entry.package.version === pack.version,
    )
  )
    return 'retained';
  return 'internal';
}

export function createProcessingProfiles(
  stepwise: boolean,
  additional: readonly ProcessingProfile[] = [],
  snapshots?: readonly PackagePublication[],
): {
  has: (version: string) => boolean;
  available: () => DocumentPackage[];
  resolve: ResolveWorkPackage;
  publications: readonly PackagePublication[];
  requirements: ReadTemplateRequirements;
} {
  const profiles = registeredProfiles(additional);
  const publications =
    snapshots ??
    [...profiles.values()].flatMap(({ id, revision, packages }) =>
      packages.map((description) => ({
        ...description,
        profile: { id, revision },
      })),
    );
  const packages = new Map<string, WorkPackage>();
  const available: DocumentPackage[] = [];
  const requirements = new Map<
    string,
    Awaited<ReturnType<ReadTemplateRequirements>>
  >();
  for (const description of publications) {
    const pack = description.package;
    const scope = publicationScope(description);
    const profile = profiles.get(profileIdentity(description.profile));
    if (!profile) {
      if (scope === 'internal' && pack.technical) continue;
      throw new Error(`UNREGISTERED_PROCESSING_PROFILE: ${pack.version}`);
    }
    if (
      scope !== 'internal' &&
      (pack.technical || !profile.allowsProductionPublication)
    )
      throw new Error(`INVALID_PACKAGE_SCOPE: ${pack.version}`);
    if (
      pack.documents.some(
        ({ filling }) =>
          filling &&
          (!isTemplateFilling(filling) ||
            !profile.fillingFunctions?.includes(filling.functionId)),
      )
    )
      throw new Error('UNREGISTERED_FILLING_FUNCTION');
    if (packages.has(pack.version))
      throw new Error('DUPLICATE_PACKAGE_VERSION');
    if (new Set(pack.fields.map(({ key }) => key)).size !== pack.fields.length)
      throw new Error('DUPLICATE_PACKAGE_FIELD');
    const profileRef = description.profile;
    if (scope === 'production') available.push(pack);
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
  const defaultVersion = defaultBflPackage.package.version;
  available.sort(
    (a, b) =>
      Number(b.version === defaultVersion) -
        Number(a.version === defaultVersion) ||
      a.version.localeCompare(b.version),
  );
  return {
    publications,
    available: () => [...available],
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
          extraction: () => instructions.extraction,
          reconciliation: (_available, checklist) =>
            checklist
              ? instructions.reconciliationWithChecklist
              : instructions.reconciliation,
          chat: () => instructions.chat,
        }
      : policy,
  };
}
