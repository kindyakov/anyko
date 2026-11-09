import { templateBytes } from '../src/modules/templates';

for (const version of [
  'bfl-statement-v1',
  'bfl-statement-v2',
  'bfl-statement-v3',
  'bfl-inventory-v1',
  'bfl-creditors-v1',
]) {
  if (!templateBytes(version).length)
    throw new Error(`Empty template: ${version}`);
}
console.log('All compiled DOCX template checksums match');
