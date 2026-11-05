import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const python =
  process.env.ANYKO_PROCESSOR_TEST_PYTHON ??
  ['work/mineru/.venv/Scripts/python.exe', 'work/mineru/.venv/bin/python'].find(
    existsSync,
  ) ??
  'python';
const result = spawnSync(
  python,
  ['-B', '-m', 'unittest', 'discover', '-s', 'tests/processor', '-v'],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
