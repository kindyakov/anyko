import { symlinkSync } from 'node:fs';
import { resolve, sep } from 'node:path';
const root = resolve('work/processor-tests') + sep;
const [target, link] = process.argv.slice(2).map((path) => resolve(path));
if (!target || !link || !target.startsWith(root) || !link.startsWith(root))
  throw new Error('Unsafe fixture paths');
symlinkSync(target, link, 'junction');
