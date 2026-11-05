import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function markdownFiles(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'brand') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await markdownFiles(file)));
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(file);
  }
  return result;
}

const documents = [
  ...['README.md', 'AGENTS.md', 'GLOSSARY.md', 'mvp.md'].map((file) =>
    path.join(root, file),
  ),
  ...(await markdownFiles(path.join(root, 'docs'))),
];
let links = 0;
for (const file of documents) {
  const content = await readFile(file, 'utf8');
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, '');
    if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target)) continue;
    const pathname = target.split('#', 1)[0];
    if (!pathname) continue;
    links++;
    if (
      !(await exists(
        path.resolve(path.dirname(file), decodeURIComponent(pathname)),
      ))
    ) {
      errors.push(`${path.relative(root, file)}: missing link ${target}`);
    }
  }
}

const readManifest = async (file) => JSON.parse(await readFile(file, 'utf8'));
const rootManifest = await readManifest(path.join(root, 'package.json'));
const manifests = new Map();
for (const group of ['apps', 'packages']) {
  if (!rootManifest.workspaces?.includes(`${group}/*`)) {
    errors.push(`package.json: workspace ${group}/* is not registered`);
  }
  for (const entry of await readdir(path.join(root, group), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(root, group, entry.name, 'package.json');
    if (!(await exists(file))) {
      errors.push(`${path.relative(root, file)}: missing workspace manifest`);
      continue;
    }
    const manifest = await readManifest(file);
    if (!manifest.name)
      errors.push(`${path.relative(root, file)}: missing package name`);
    else if (manifests.has(manifest.name))
      errors.push(`duplicate workspace name ${manifest.name}`);
    else manifests.set(manifest.name, { file, manifest });
  }
}
for (const { file, manifest } of [
  { file: path.join(root, 'package.json'), manifest: rootManifest },
  ...manifests.values(),
]) {
  for (const section of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
  ]) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (version.startsWith('workspace:') && !manifests.has(name)) {
        errors.push(
          `${path.relative(root, file)}: missing workspace dependency ${name}`,
        );
      }
    }
  }
}

// Only executable guidance is checked. Engineering policy includes intentionally
// future commands and must not be interpreted as claiming they already exist.
for (const relative of ['README.md', '.github/workflows/ci.yml']) {
  const content = await readFile(path.join(root, relative), 'utf8');
  for (const match of content.matchAll(/\bbun run ([\w:-]+)/g)) {
    if (!(match[1] in (rootManifest.scripts ?? {}))) {
      errors.push(`${relative}: missing root script ${match[1]}`);
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(
    `Project checks passed: ${documents.length} markdown files, ${links} local links, ${manifests.size} workspaces; README/CI script references.`,
  );
}
