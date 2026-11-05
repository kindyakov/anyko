import type { Database } from '@anyko/database';
import type { ArtifactRegistry } from '../application/ports';
export function createArtifactRegistry(db: Database): ArtifactRegistry {
  return {
    async stage(artifact) {
      await db.documentArtifact.create({ data: artifact });
    },
    async forget(key) {
      await db.documentArtifact.deleteMany({ where: { key } });
    },
  };
}
