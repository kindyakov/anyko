import { expect, test } from 'bun:test';

import PizZip from 'pizzip';

import {
  formatBankruptcyScalar,
  formatCreditorText,
} from '@anyko/document-values/bankruptcy-format';

import { generateDocument } from '../src/modules/generation';
import { templateBytes, templateData } from '../src/modules/templates';
import { emptyFieldValues } from '../src/profiles/bfl/fields';

test('creditor names use sentence case in expanded legal forms and preserve abbreviations', () => {
  expect(
    formatCreditorText('ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "СБЕРБАНК РОССИИ"'),
  ).toBe('Публичное акционерное общество «Сбербанк России»');
  expect(
    formatCreditorText(
      'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ МИКРОКРЕДИТНАЯ КОМПАНИЯ "ОЗОН КРЕДИТ"',
    ),
  ).toBe(
    'Общество с ограниченной ответственностью микрокредитная компания «Озон Кредит»',
  );
  expect(formatCreditorText('ПАО "МТС-БАНК"')).toBe('ПАО «МТС-Банк»');
});

test('passport names of places keep service words and settlement abbreviations lowercase', () => {
  expect(
    formatBankruptcyScalar(
      'passportIssuer',
      'ОТДЕЛОМ УФМС РОССИИ ПО ЛИПЕЦКОЙ ОБЛАСТИ В ЗАДОНСКОМ РАЙОНЕ',
    ),
  ).toBe('Отделом УФМС России по Липецкой области в Задонском районе');
  expect(
    formatBankruptcyScalar(
      'birthPlace',
      'С. ХОХОЛ ХОХОЛЬСКОГО Р-НА ВОРОНЕЖСКОЙ ОБЛ.',
    ),
  ).toBe('с. Хохол Хохольского р-на Воронежской обл.');
  expect(formatBankruptcyScalar('birthPlace', 'П. ТИХИЙ')).toBe('п. Тихий');
  expect(formatBankruptcyScalar('birthPlace', 'Д. БЕРЁЗОВКА')).toBe(
    'д. Берёзовка',
  );
});

test('the creditor list v3 uses one dash in empty columns while retaining the unknown marker', () => {
  const version = 'bfl-creditors-v3';
  const facts = { ...emptyFieldValues(), debts: [], businessDebts: [] };
  const generated = new PizZip(
    generateDocument(templateBytes(version), templateData(facts, version)),
  );
  const xml = generated.file('word/document.xml')?.asText() ?? '';
  const cellContents = Array.from(
    xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/gu),
    (match) => match[1],
  );
  expect(cellContents).toContain('-');
  expect(cellContents).toContain('[не заполнено]');
  expect(cellContents).not.toContain('—');
});
