import PizZip from 'pizzip';
import type { Template } from '@anyko/contracts';

export const technicalTemplate: Template = {
  id: 'technical-document',
  version: 'technical-document-v1',
  title: 'Технический шаблон документа',
  technical: true,
  fields: [
    { key: 'personName', label: 'Имя в исходных документах', multiline: false },
    { key: 'documentNumber', label: 'Номер документа', multiline: false },
    { key: 'documentDate', label: 'Дата документа', multiline: false },
    {
      key: 'observations',
      label: 'Сведения и визуальные наблюдения',
      multiline: true,
    },
  ],
};

export function requireTemplate(version: string): Template {
  if (version !== technicalTemplate.version)
    throw new Error('TEMPLATE_NOT_FOUND');
  return technicalTemplate;
}

/** An explicitly technical fixture until the approved production DOCX is supplied. */
export function templateBytes(version: string): Uint8Array {
  requireTemplate(version);
  const zip = new PizZip();
  const date = new Date('2026-01-01T00:00:00Z');
  const files = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${[
      'ТЕХНИЧЕСКИЙ ШАБЛОН — НЕ ЮРИДИЧЕСКОЕ ЗАЯВЛЕНИЕ',
      'Имя: {personName}',
      'Номер документа: {documentNumber}',
      'Дата: {documentDate}',
      'Сведения и визуальные наблюдения:',
      '{observations}',
    ]
      .map(
        (line) =>
          `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">${line}</w:t></w:r></w:p>`,
      )
      .join(
        '',
      )}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701"/></w:sectPr></w:body></w:document>`,
  };
  for (const [name, content] of Object.entries(files))
    zip.file(name, content, { date });
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' });
}
