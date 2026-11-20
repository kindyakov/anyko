import type { Database } from '@anyko/database';

import type { ReadTemplateRequirements } from '..';

export function createTemplateRequirements(
  db: Database,
): ReadTemplateRequirements {
  return async (packageVersion) => {
    const templates = await db.packageDocument.findMany({
      where: { packageVersion },
      orderBy: { position: 'asc' },
      select: {
        template: {
          select: {
            requirements: {
              orderBy: { position: 'asc' },
              select: {
                key: true,
                documentKind: true,
                label: true,
                applicability: true,
              },
            },
          },
        },
      },
    });
    const requirements = new Map<
      string,
      Awaited<ReturnType<ReadTemplateRequirements>>[number]
    >();
    for (const { template } of templates)
      for (const requirement of template.requirements)
        if (!requirements.has(requirement.key))
          requirements.set(requirement.key, requirement);
    return [...requirements.values()];
  };
}
