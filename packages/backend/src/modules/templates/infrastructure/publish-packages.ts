import type { Database } from '@anyko/database';

import type { PackagePublication } from '../../../profiles/package-description';
import {
  canonicalJson,
  contentHash,
  parsePackagePublication,
  validatePackageDescription,
} from '../validate-package-description';

interface RegisteredPublication {
  description: PackagePublication;
  templateBytes: (version: string) => Uint8Array;
}

function conflict(version: string): never {
  throw new Error(`Catalog version differs from its description: ${version}`);
}

function templateCatalogData(
  description: PackagePublication,
  template: PackagePublication['package']['documents'][number],
) {
  const { version } = template;
  const templateTitle =
    description.catalogTitles?.templates[version] ?? template.title;
  const templateRequirements = [
    ...(description.requirements[version] ?? []),
  ].sort((a, b) => a.position - b.position);
  const templateHash = contentHash({
    template,
    templateTitle,
    templateRequirements,
  });
  return { templateTitle, templateRequirements, templateHash };
}

export async function readPublishedPackages(db: Database) {
  const rows = await db.documentPackageVersion.findMany({
    where: { descriptionHash: { not: null } },
    include: {
      documents: {
        orderBy: { position: 'asc' },
        include: { template: true },
      },
    },
  });
  return rows.map((row) => {
    if (!row.description) return conflict(row.version);
    const description = parsePackagePublication(JSON.parse(row.description));
    const pack = description.package;
    if (
      row.version !== pack.version ||
      row.packageId !== pack.id ||
      row.title !== (description.catalogTitles?.package ?? pack.title) ||
      row.description !== canonicalJson(description) ||
      row.descriptionHash !== contentHash(description) ||
      row.documents.length !== pack.documents.length
    )
      return conflict(row.version);
    for (const [index, template] of pack.documents.entries()) {
      const link = row.documents[index];
      const { templateTitle, templateHash } = templateCatalogData(
        description,
        template,
      );
      if (
        link?.position !== index ||
        link.templateVersion !== template.version ||
        link.template.templateId !== template.id ||
        link.template.title !== templateTitle ||
        link.template.checksum !== template.checksum ||
        link.template.descriptionHash !== templateHash
      )
        return conflict(template.version);
    }
    return description;
  });
}

export async function publishPackages(
  db: Database,
  publications: readonly RegisteredPublication[],
  { adoptLegacy = true }: { adoptLegacy?: boolean } = {},
) {
  const validated = publications.map(({ description, templateBytes }) => {
    const snapshot = structuredClone(description);
    return {
      description: snapshot,
      hash: validatePackageDescription(snapshot, templateBytes),
    };
  });

  return db.$transaction(async (tx) => {
    // Template versions may be shared across packages. Serialize the complete
    // catalog comparison and write so two different publications cannot adopt
    // or insert overlapping versions concurrently.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('anyko:package-catalog', 0))::text`;
    const results: {
      version: string;
      status: 'created' | 'adopted' | 'unchanged';
    }[] = [];
    for (const { description, hash } of validated) {
      const { package: pack, catalogTitles } = description;
      const { version } = pack;
      const title = catalogTitles?.package ?? pack.title;
      const documents = pack.documents.map(
        ({ version: templateVersion }, position) => ({
          templateVersion,
          position,
        }),
      );
      const existing = await tx.documentPackageVersion.findUnique({
        where: { version },
        include: {
          documents: {
            orderBy: { position: 'asc' },
            select: { templateVersion: true, position: true },
          },
        },
      });
      const canonical = canonicalJson(description);
      if (
        existing &&
        (existing.title !== title ||
          existing.packageId !== pack.id ||
          canonicalJson(existing.documents) !== canonicalJson(documents) ||
          (!adoptLegacy && existing.descriptionHash === null) ||
          (existing.descriptionHash !== null &&
            (existing.descriptionHash !== hash ||
              existing.description !== canonical)))
      )
        conflict(version);

      for (const template of pack.documents) {
        const { templateTitle, templateRequirements, templateHash } =
          templateCatalogData(description, template);
        const placeholders = [...(template.placeholders ?? [])].sort((a, b) =>
          a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0,
        );
        const current = await tx.documentTemplateVersion.findUnique({
          where: { version: template.version },
          include: {
            placeholders: {
              select: { tag: true, field: true, placeholder: true },
            },
            requirements: {
              select: {
                position: true,
                key: true,
                documentKind: true,
                label: true,
                applicability: true,
              },
              orderBy: { position: 'asc' },
            },
          },
        });
        if (current) {
          if (
            current.templateId !== template.id ||
            current.title !== templateTitle ||
            current.checksum !== template.checksum ||
            (!adoptLegacy && current.descriptionHash === null) ||
            canonicalJson(current.requirements) !==
              canonicalJson(templateRequirements) ||
            canonicalJson(
              current.placeholders.sort((a, b) =>
                a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0,
              ),
            ) !== canonicalJson(placeholders) ||
            (current.descriptionHash !== null &&
              current.descriptionHash !== templateHash)
          )
            conflict(template.version);
          if (current.descriptionHash === null)
            await tx.documentTemplateVersion.update({
              where: { version: template.version },
              data: { descriptionHash: templateHash },
            });
        } else {
          await tx.documentTemplateVersion.create({
            data: {
              version: template.version,
              templateId: template.id,
              title: templateTitle,
              checksum: template.checksum,
              descriptionHash: templateHash,
              placeholders: { create: placeholders },
              requirements: { create: templateRequirements },
            },
          });
        }
      }

      if (!existing) {
        await tx.documentPackageVersion.create({
          data: {
            version,
            packageId: pack.id,
            title,
            descriptionHash: hash,
            description: canonical,
            documents: { create: documents },
          },
        });
      } else if (existing.descriptionHash === null) {
        await tx.documentPackageVersion.update({
          where: { version },
          data: { descriptionHash: hash, description: canonical },
        });
      }
      results.push({
        version,
        status: !existing
          ? 'created'
          : existing.descriptionHash === null
            ? 'adopted'
            : 'unchanged',
      });
    }
    return results;
  });
}
