// Заголовки файлов распознавания и документов работы. Документ открывается в песочнице: браузер не
// выполняет содержимое в контексте приложения.
const sandboxed = "default-src 'none'; sandbox";

export function sourceFileHeaders(source: {
  contentType: string;
  filename: string;
}): Record<string, string> {
  return {
    'content-type': source.contentType,
    'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(source.filename)}`,
    'content-security-policy': sandboxed,
  };
}

export function imageHeaders(contentType: string): Record<string, string> {
  return {
    'content-type': contentType,
    'content-security-policy': sandboxed,
  };
}

// Индекс не в диапазоне даёт -1: сценарий вернёт NOT_FOUND, как и раньше.
export function imageIndex(value: string): number {
  return /^\d{1,2}$/.test(value) ? Number(value) : -1;
}
