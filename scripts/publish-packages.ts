import { publishCatalog } from '../packages/backend/src/runtime/publish-packages';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required to publish packages');
const [option, path, ...extra] = Bun.argv.slice(2);
if (extra.length || (path && option !== '--description'))
  throw new Error(
    'Usage: publish-packages [--adopt | --verify | --description FILE]',
  );
const command =
  option === '--adopt'
    ? { mode: 'adopt' as const }
    : option === '--verify'
      ? { mode: 'verify' as const }
      : option === '--description' && path
        ? { mode: 'description' as const, input: await Bun.file(path).json() }
        : option === undefined
          ? { mode: 'publish' as const }
          : undefined;
if (!command)
  throw new Error(
    'Usage: publish-packages [--adopt | --verify | --description FILE]',
  );
for (const { version, status } of await publishCatalog(url, command))
  console.log(`${version}: ${status}`);
