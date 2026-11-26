import { prepareTemplate } from '@anyko/document-values/template-filling';
import { DiagnosticError } from '@anyko/logger';

import {
  type DocumentPackage,
  knownPackages,
  templateBytes,
} from '../modules/templates';
import { resolveBflAnalysis } from '../profiles/bfl/work-analysis';
import type { WorkAnalysisDefinition } from '../workflows/work-analysis/definition';
import type {
  ResolveWorkPackage,
  WorkPackage,
} from '../workflows/work-package';

export interface ProcessingProfile {
  id: string;
  revision: string;
  packages: readonly DocumentPackage[];
  analysis?(pack: DocumentPackage, stepwise: boolean): WorkAnalysisDefinition;
  templateBytes: WorkPackage['templateBytes'];
  templateData(
    values: Parameters<WorkPackage['templateData']>[0],
    template: DocumentPackage['documents'][number],
    referenceDate: string,
    pack: DocumentPackage,
  ): ReturnType<WorkPackage['templateData']>;
}

export function createProcessingProfiles(
  stepwise: boolean,
  additional: readonly ProcessingProfile[] = [],
): { has: (version: string) => boolean; resolve: ResolveWorkPackage } {
  const render: ProcessingProfile['templateData'] = (
    values,
    template,
    referenceDate,
    pack,
  ) => {
    const { scalars, repeating } = prepareTemplate(
      { ...template, fields: pack.fields },
      values,
      { referenceDate },
    );
    return { ...scalars, ...repeating };
  };
  const profiles: readonly ProcessingProfile[] = [
    {
      id: 'bfl-bankruptcy',
      revision: '1',
      packages: knownPackages.filter(({ id }) => id === 'bfl-bankruptcy'),
      analysis: resolveBflAnalysis,
      templateBytes,
      templateData: render,
    },
    {
      id: 'technical-document',
      revision: '1',
      packages: knownPackages.filter(({ id }) => id === 'technical-document'),
      templateBytes,
      templateData: render,
    },
    ...additional,
  ];
  const registered = new Set<string>();
  const packages = new Map<string, WorkPackage>();
  for (const profile of profiles) {
    const identity = JSON.stringify([profile.id, profile.revision]);
    if (registered.has(identity))
      throw new Error('DUPLICATE_PROCESSING_PROFILE');
    registered.add(identity);
    for (const pack of profile.packages) {
      if (packages.has(pack.version))
        throw new Error('DUPLICATE_PACKAGE_VERSION');
      if (
        new Set(pack.fields.map(({ key }) => key)).size !== pack.fields.length
      )
        throw new Error('DUPLICATE_PACKAGE_FIELD');
      packages.set(pack.version, {
        profile: { id: profile.id, revision: profile.revision },
        description: pack,
        analysis: profile.analysis?.(pack, stepwise) ?? {
          fields: pack.fields,
          policy: {},
          plan: undefined,
        },
        templateBytes: profile.templateBytes,
        templateData: (values, template, date) =>
          profile.templateData(values, template, date, pack),
      });
    }
  }
  return {
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
