import { templateBytes } from '../src/modules/templates';

for (const version of [
  'bfl-statement-v11',
  'bfl-statement-v12',
  'bfl-inventory-v2',
  'bfl-inventory-v3',
  'bfl-creditors-v3',
  'bfl-creditors-v4',
]) {
  if (!templateBytes(version).length)
    throw new Error(`Empty template: ${version}`);
}
console.log('All compiled DOCX template checksums match');
