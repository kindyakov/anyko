import { publishCatalog } from '../packages/backend/src/runtime/publish-packages';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required to publish packages');
for (const { version, status } of await publishCatalog(url))
  console.log(`${version}: ${status}`);
