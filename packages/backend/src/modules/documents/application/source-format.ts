import { unzipSync } from 'fflate';

export type SourceFormat = 'pdf' | 'docx' | 'jpg' | 'png' | 'webp' | 'tiff';

const formats: Record<string, SourceFormat> = {
  pdf: 'pdf',
  docx: 'docx',
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  tif: 'tiff',
  tiff: 'tiff',
};

export const sourceContentTypes: Record<SourceFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  tiff: 'image/tiff',
};

export function sourceFormatFromKey(key: string): SourceFormat | undefined {
  const extension = key.split('.').at(-1)?.toLowerCase() ?? '';
  return Object.hasOwn(formats, extension) ? formats[extension] : undefined;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function isDocx(bytes: Uint8Array) {
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return false;
  const names = new Set<string>();
  let expandedBytes = 0;
  try {
    // Inspect every entry, but inflate only the bounded package content types.
    const entries = unzipSync(bytes, {
      filter(entry) {
        expandedBytes += entry.originalSize;
        if (
          names.has(entry.name) ||
          names.size >= 2048 ||
          entry.originalSize > 32 * 1024 * 1024 ||
          expandedBytes > 100 * 1024 * 1024 ||
          entry.name.startsWith('/') ||
          entry.name.includes('\\') ||
          entry.name.split('/').includes('..')
        )
          throw new Error('INVALID_DOCX_PACKAGE');
        names.add(entry.name);
        return (
          entry.name === '[Content_Types].xml' &&
          entry.originalSize <= 64 * 1024
        );
      },
    });
    const contentTypes = entries['[Content_Types].xml'];
    if (!names.has('word/document.xml') || !contentTypes) return false;
    const xml = new TextDecoder('utf-8', { fatal: true }).decode(contentTypes);
    return [...xml.matchAll(/<Override\b[^>]*>/g)].some(
      ([tag]) =>
        /\bPartName\s*=\s*["']\/word\/document\.xml["']/.test(tag) &&
        /\bContentType\s*=\s*["']application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document\.main\+xml["']/.test(
          tag,
        ),
    );
  } catch {
    return false;
  }
}

export function matchesSourceFormat(bytes: Uint8Array, format: SourceFormat) {
  if (bytes.length < 5 || bytes.length > 20 * 1024 * 1024) return false;
  switch (format) {
    case 'pdf':
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case 'jpg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'png':
      return startsWith(
        bytes,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      );
    case 'webp':
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
      );
    case 'tiff':
      return (
        startsWith(bytes, [0x49, 0x49, 0x2a, 0]) ||
        startsWith(bytes, [0x4d, 0x4d, 0, 0x2a])
      );
    case 'docx':
      return isDocx(bytes);
  }
}
