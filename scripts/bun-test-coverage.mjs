import path from 'node:path';

const flagsWithValues = new Set([
  '--coverage-dir',
  '--coverage-reporter',
  '--env-file',
  '--max-concurrency',
  '--parallel-delay',
  '--path-ignore-patterns',
  '--preload',
  '--reporter',
  '--reporter-outfile',
  '--rerun-each',
  '--retry',
  '--seed',
  '--shard',
  '--test-name-pattern',
  '--timeout',
  '--timings',
  '-r',
  '-t',
]);

function bunTestPaths(script) {
  // Inspect literal commands without running package scripts or expanding shell variables.
  const tokens = script.match(/(?:[^\s"'&|;]|"[^"]*"|'[^']*')+|[&|;]+/g) ?? [];
  const commands = [[]];
  for (const token of tokens) {
    if (/^[&|;]+$/.test(token)) commands.push([]);
    else commands.at(-1).push(token);
  }

  const paths = [];
  for (const command of commands) {
    const start = command.findIndex((token) => !/^\w+=/.test(token));
    if (command[start] !== 'bun' || command[start + 1] !== 'test') continue;
    for (let index = start + 2; index < command.length; index++) {
      const token = command[index];
      if (flagsWithValues.has(token)) index++;
      else if (!token.startsWith('-')) {
        const target = token.replace(/^['"]|['"]$/g, '');
        if (target) paths.push(target);
      }
    }
  }
  return paths;
}

export function uncoveredBunTests(root, trackedFiles, manifests) {
  const targets = new Set();
  for (const { file, manifest } of manifests) {
    const cwd = path.dirname(file);
    for (const script of Object.values(manifest.scripts ?? {})) {
      for (const target of bunTestPaths(script)) {
        targets.add(path.resolve(cwd, target));
      }
    }
  }

  return trackedFiles.filter((file) => {
    if (file.startsWith('work/') || !/\.test\.tsx?$/.test(file)) return false;
    let candidate = path.resolve(root, file);
    while (candidate !== path.dirname(candidate)) {
      if (targets.has(candidate)) return false;
      candidate = path.dirname(candidate);
    }
    return !targets.has(candidate);
  });
}
