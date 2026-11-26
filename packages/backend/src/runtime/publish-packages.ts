import {
  createDatabase,
  createDatabasePool,
  type Database,
} from '@anyko/database';

import {
  parsePackagePublication,
  validatePackageDescription,
} from '../modules/templates';
import {
  publishPackages,
  readPublishedPackages,
} from '../modules/templates/infrastructure/publish-packages';

import {
  createProcessingProfiles,
  type ProcessingProfile,
} from './processing-profiles';

export function publishRegisteredPackages(
  db: Database,
  additional: readonly ProcessingProfile[] = [],
  profileId?: string,
) {
  const profiles = createProcessingProfiles(false, additional);
  return publishPackages(
    db,
    profiles.publications
      .filter(
        ({ profile }) => profileId === undefined || profile.id === profileId,
      )
      .map((description) => ({
        description,
        templateBytes: profiles.resolve(description.package.version)
          .templateBytes,
      })),
  );
}

export async function loadPublishedProcessingProfiles(
  db: Database,
  stepwise: boolean,
  additional: readonly ProcessingProfile[] = [],
) {
  const snapshots = await readPublishedPackages(db);
  const profiles = createProcessingProfiles(stepwise, additional, snapshots);
  const baseline = createProcessingProfiles(false);
  const baselineVersion = baseline.available()[0]?.version;
  for (const { package: pack, profile } of baseline.publications) {
    const snapshot = snapshots.find(
      ({ package: { version } }) => version === pack.version,
    );
    if (
      !snapshot ||
      snapshot.profile.id !== profile.id ||
      snapshot.profile.revision !== profile.revision ||
      snapshot.package.technical !== pack.technical ||
      (snapshot.scope !== undefined &&
        snapshot.scope !==
          (pack.technical
            ? 'internal'
            : baselineVersion === pack.version
              ? 'production'
              : 'retained'))
    )
      throw new Error(
        `Package baseline unavailable: ${pack.version}; run db:publish-packages --adopt`,
      );
  }
  for (const description of snapshots) {
    const { version } = description.package;
    if (profiles.has(version))
      validatePackageDescription(
        description,
        profiles.resolve(version).templateBytes,
      );
  }
  return profiles;
}

type CatalogCommand =
  | { mode: 'publish' | 'adopt' | 'verify' }
  | { mode: 'description'; input: unknown };

export async function publishCatalog(url: string, command: CatalogCommand) {
  const pool = createDatabasePool(url);
  const db = createDatabase(pool);
  try {
    if (command.mode === 'publish') return await publishRegisteredPackages(db);
    if (command.mode === 'description') {
      const description = parsePackagePublication(command.input);
      if (description.scope !== 'production')
        throw new Error('A new catalog description requires production scope');
      const { templateBytes } = createProcessingProfiles(
        false,
        [],
        [description],
      ).resolve(description.package.version);
      return await publishPackages(db, [{ description, templateBytes }], {
        adoptLegacy: false,
      });
    }
    if (command.mode === 'verify') {
      const profiles = await loadPublishedProcessingProfiles(db, false);
      return profiles.publications.map(({ package: { version } }) => ({
        version,
        status: 'verified',
      }));
    }
    const profiles = createProcessingProfiles(false);
    const published = new Set(
      (await readPublishedPackages(db)).map(
        ({ package: { version } }) => version,
      ),
    );
    const pending = profiles.publications
      .filter(({ package: { version } }) => !published.has(version))
      .map((description) => ({
        description,
        templateBytes: profiles.resolve(description.package.version)
          .templateBytes,
      }));
    const results = pending.length ? await publishPackages(db, pending) : [];
    await loadPublishedProcessingProfiles(db, false);
    return results;
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}
