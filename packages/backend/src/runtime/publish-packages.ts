import {
  createDatabase,
  createDatabasePool,
  type Database,
} from '@anyko/database';

import { publishPackages } from '../modules/templates/infrastructure/publish-packages';

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

export async function publishCatalog(url: string) {
  const pool = createDatabasePool(url);
  const db = createDatabase(pool);
  try {
    return await publishRegisteredPackages(db);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}
