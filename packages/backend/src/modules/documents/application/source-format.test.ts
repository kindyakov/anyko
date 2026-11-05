import { expect, test } from 'bun:test';
import { strToU8, zipSync } from 'fflate';
import { matchesSourceFormat, sourceFormatFromKey } from './source-format';

const contentTypes = strToU8(
  '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
);
const docx = zipSync({
  '[Content_Types].xml': contentTypes,
  'word/document.xml': strToU8('<w:document><w:body/></w:document>'),
});

test('accepts supported signatures and canonicalizes filename aliases', () => {
  expect(sourceFormatFromKey('PHOTO.JPEG')).toBe('jpg');
  expect(sourceFormatFromKey('scan.TIF')).toBe('tiff');
  expect(sourceFormatFromKey('sources/workspace/id.pdf')).toBe('pdf');
  expect(sourceFormatFromKey('photo.heic')).toBeUndefined();
  expect(matchesSourceFormat(strToU8('%PDF-1.7 fixture'), 'pdf')).toBe(true);
  expect(
    matchesSourceFormat(new Uint8Array([255, 216, 255, 224, 0]), 'jpg'),
  ).toBe(true);
  expect(
    matchesSourceFormat(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      'png',
    ),
  ).toBe(true);
  expect(matchesSourceFormat(strToU8('RIFFxxxxWEBPVP8 '), 'webp')).toBe(true);
  expect(matchesSourceFormat(new Uint8Array([73, 73, 42, 0, 8]), 'tiff')).toBe(
    true,
  );
  expect(matchesSourceFormat(docx, 'docx')).toBe(true);
});

test('rejects mislabeled content, arbitrary ZIPs and oversized DOCX entries', () => {
  expect(matchesSourceFormat(strToU8('%PDF-1.7 fixture'), 'jpg')).toBe(false);
  expect(matchesSourceFormat(new Uint8Array([255, 216, 255]), 'jpg')).toBe(
    false,
  );
  expect(
    matchesSourceFormat(zipSync({ 'notes.txt': strToU8('not docx') }), 'docx'),
  ).toBe(false);
  expect(
    matchesSourceFormat(
      zipSync({
        '[Content_Types].xml': contentTypes,
        'word/document.xml': new Uint8Array(33 * 1024 * 1024),
      }),
      'docx',
    ),
  ).toBe(false);
  expect(
    matchesSourceFormat(
      zipSync({
        '[Content_Types].xml': strToU8('<Types/>'),
        'word/document.xml': strToU8('not a Word package'),
      }),
      'docx',
    ),
  ).toBe(false);
});
