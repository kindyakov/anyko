import { comparableText } from '@anyko/document-values/text-value';

const passportTitle = 'паспорт гражданина российской федерации';

export function russianPassportCitation(text: string): string | undefined {
  const lines = text.split(/\r?\n/u);
  const normalized = lines.map(comparableText);
  const title = normalized.indexOf(passportTitle);
  if (title !== -1) return lines[title]?.trim();

  // Some OCR engines return only the country heading and individual passport labels.
  // Keep the contiguous quote so the heading has context when the fact is reviewed.
  const start = normalized.indexOf('российская федерация');
  if (start < 0) return undefined;
  const end = [
    /^фамилия(?:$|[ :])/u,
    /^имя(?:$|[ :])/u,
    /^место рождения(?:$|[ :])/u,
  ].map((label) =>
    normalized.findIndex((line, index) => index > start && label.test(line)),
  );
  if (end.includes(-1)) return undefined;
  const citation = lines
    .slice(start, Math.max(...end) + 1)
    .join('\n')
    .trim();
  const sourceCitation = text.includes(citation)
    ? citation
    : citation.replace(/\n/gu, '\r\n');
  return sourceCitation.length <= 2000 && text.includes(sourceCitation)
    ? sourceCitation
    : undefined;
}

export function hasRussianPassportCitizenship(value: string, quote: string) {
  const expected = comparableText(value);
  return (
    ['российская федерация', 'россия', 'рф'].includes(expected) &&
    !!russianPassportCitation(quote)
  );
}
