import { execFileSync } from 'node:child_process';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { apiCatalogIsCurrent, renderApiCatalog } from './api-catalog';
import { uncoveredBunTests } from './bun-test-coverage.mjs';
import {
  architectureDocumentErrors,
  localMarkdownLinks,
} from './project-documents.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
if (!(await apiCatalogIsCurrent(renderApiCatalog()))) {
  errors.push('docs/engineering/api-catalog.md: run bun run api:catalog');
}

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

const readManifest = async (file) => JSON.parse(await readFile(file, 'utf8'));
const rootManifest = await readManifest(path.join(root, 'package.json'));
const manifests = new Map();
const architectureFiles = [];
const anchorSources = [];
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
    const architecture = path.join(path.dirname(file), 'ARCHITECTURE.md');
    architectureFiles.push(architecture);
    if (await exists(architecture)) anchorSources.push(architecture);
    if (group === 'apps') {
      const agents = path.join(path.dirname(file), 'AGENTS.md');
      if (await exists(agents)) anchorSources.push(agents);
    }
    const manifest = await readManifest(file);
    if (!manifest.name)
      errors.push(`${path.relative(root, file)}: missing package name`);
    else if (manifests.has(manifest.name))
      errors.push(`duplicate workspace name ${manifest.name}`);
    else manifests.set(manifest.name, { file, manifest });
  }
}

const documents = [
  ...['README.md', 'AGENTS.md', 'GLOSSARY.md', 'mvp.md'].map((file) =>
    path.join(root, file),
  ),
  ...(await markdownFiles(path.join(root, 'docs'))),
  ...anchorSources,
];
const markdown = new Map(
  await Promise.all(
    documents.map(async (file) => [file, await readFile(file, 'utf8')]),
  ),
);
let links = 0;
for (const file of documents) {
  for (const link of localMarkdownLinks(file, markdown.get(file))) {
    links++;
    if (!markdown.has(link.file) && !(await exists(link.file))) {
      errors.push(`${path.relative(root, file)}: missing link ${link.target}`);
    } else if (
      link.anchor &&
      anchorSources.includes(file) &&
      path.extname(link.file).toLowerCase() === '.md' &&
      !markdown.has(link.file)
    ) {
      markdown.set(link.file, await readFile(link.file, 'utf8'));
    }
  }
}
errors.push(
  ...architectureDocumentErrors(
    root,
    architectureFiles,
    anchorSources,
    markdown,
  ),
);

const packageManifests = [
  { file: path.join(root, 'package.json'), manifest: rootManifest },
  ...manifests.values(),
];
for (const { file, manifest } of packageManifests) {
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

const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8',
}).split('\0');
for (const file of uncoveredBunTests(root, trackedFiles, packageManifests)) {
  errors.push(
    `${file}: добавьте файл в команду bun test в подходящем package.json.`,
  );
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
    `Project checks passed: ${documents.length} markdown files, ${links} local links, ${manifests.size} workspaces; workspace architecture, README/CI script references and Bun test coverage.`,
  );
}
