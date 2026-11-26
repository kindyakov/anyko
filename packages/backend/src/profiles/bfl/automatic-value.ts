import type { z } from 'zod';

import {
  canonicalCalendarDate,
  datesInText,
  formatCalendarDate,
} from '@anyko/document-values/calendar-date';
import {
  employmentEvents,
  employmentFields,
  employmentMonth,
} from '@anyko/document-values/employment';
import {
  canonicalMoneyAmount,
  moneyAmountsInText,
} from '@anyko/document-values/money';
import {
  creditorRegistryColumns,
  isBankObligation,
  obligationFields,
  obligationStatuses,
} from '@anyko/document-values/obligations';

import type { FieldDefinition } from '../fields';
import { attestedAmount, attestedDate, typedEvidence } from '../value-types';

import { businessAbsenceRule } from './business-absence';
import {
  cadastralNumbersIn,
  canonicalCadastralNumber,
} from './cadastral-number';
import type { candidateSchema } from './candidate';
import {
  bflField,
  fieldIdentity,
  type FieldRow,
  type FieldValue,
} from './fields';
import { evidencedObligationType } from './obligation-type';
import { hasRussianPassportCitizenship } from './passport-evidence';

type Candidate = z.infer<typeof candidateSchema>;

function proofLines(evidence: Candidate['evidence'], includeVisuals = false) {
  return evidence
    .filter(({ imagePath }) => includeVisuals || imagePath === null)
    .flatMap(({ quote }) => sourceLines(quote));
}

function sourceLines(text: string) {
  return text
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\([.()+-])/g, '$1')
    .split(/\r?\n/);
}

/** Automatic values need numeric evidence. Keep the original proposal for human review. */
export function automaticValue(
  candidate: Candidate,
  {
    sources,
    definition = bflField(candidate.field),
  }: {
    sources?: readonly FactSourceText[] | undefined;
    definition?: FieldDefinition | undefined;
  } = {},
): FieldValue {
  return supportedValue(candidate, definition, false, sources);
}

/** After evidence loss, keep only values identifiable in the remaining quotes. */
export function valueWithRemainingEvidence(
  candidate: Candidate,
  definition = bflField(candidate.field),
): FieldValue {
  return supportedValue(candidate, definition, true);
}

function comparableCitationText(text: string) {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('ru')
    .replace(/\s+/g, ' ')
    .trim();
}

function mentions(line: string, value: string) {
  return comparableCitationText(line).includes(comparableCitationText(value));
}

function citationsByDocument(evidence: Candidate['evidence']) {
  const byDocument = new Map<string, string[]>();
  for (const entry of evidence) {
    const quote = comparableCitationText(proofLines([entry], true).join(' '));
    const quotes = byDocument.get(entry.documentId) ?? [];
    quotes.push(quote);
    byDocument.set(entry.documentId, quotes);
  }
  return [...byDocument].map(([documentId, quotes]) => ({
    documentId,
    quotes,
  }));
}

function citationContainsValue(value: string, quote: string) {
  const text = comparableCitationText(value);
  if (!text) return false;
  const before = /^\p{N}/u.test(text)
    ? '(?<![\\p{L}\\p{N}]|\\p{N}[.,/])'
    : '(?<![\\p{L}\\p{N}])';
  const after = /\p{N}$/u.test(text)
    ? '(?![\\p{L}\\p{N}]|[.,/]\\p{N})'
    : '(?![\\p{L}\\p{N}])';
  return new RegExp(before + RegExp.escape(text) + after, 'u').test(quote);
}

function evidencedProperty(
  rows: FieldRow[],
  evidence: Candidate['evidence'],
  sources: readonly FactSourceText[],
) {
  const documents = citationsByDocument(evidence).map(
    ({ documentId, quotes: entries }) => {
      const quotes = entries.map((text) => ({
        text,
        numbers: cadastralNumbersIn(text),
      }));
      const otherNumbers = sources.flatMap((source) =>
        source.documentId === documentId ? cadastralNumbersIn(source.text) : [],
      );
      return {
        quotes,
        multiple:
          new Set([
            ...otherNumbers,
            ...quotes.flatMap(({ numbers }) => numbers),
          ]).size > 1,
      };
    },
  );
  return rows.every((row) => {
    const number = canonicalCadastralNumber(row.identifier ?? '');
    const address = row.address?.trim();
    if (row.identifier != null && (!number || !address)) return false;
    return documents.some(({ quotes, multiple }) => {
      // An unanchored fragment can be ambiguous when the proof names several objects.
      const relevant = quotes.filter(({ text, numbers }) => {
        if (number && numbers.some((id) => id !== number)) return false;
        return (
          !multiple ||
          (!!number && numbers.includes(number)) ||
          (!!address && citationContainsValue(address, text))
        );
      });
      return Object.entries(row).every(([column, cell]) => {
        if (cell === null) return true;
        return relevant.some(({ text, numbers }) =>
          column === 'identifier' && number
            ? numbers.includes(number)
            : citationContainsValue(cell, text),
        );
      });
    });
  });
}

const noBusinessActivity =
  /^(?:предпринимательск\p{L}*\s+деятельност\p{L}*\s+(?:никогда\s+)?не\s+(?:занимал|в[её]л|осуществлял)\p{L}*|(?:никогда\s+)?не\s+(?:занимал|в[её]л|осуществлял)\p{L}*\s+предпринимательск\p{L}*\s+деятельност\p{L}*)$/u;
const noBusinessStatus =
  /^(?:статус\p{L}*\s+(?:ип|индивидуальн\p{L}*\s+предпринимател\p{L}*)\s+(?:никогда\s+)?не\s+име\p{L}*|(?:никогда\s+)?не\s+име\p{L}*\s+статус\p{L}*\s+(?:ип|индивидуальн\p{L}*\s+предпринимател\p{L}*))$/u;

function businessStatements(text: string) {
  return text
    .split(/[.!?](?:\s+|$)/u)
    .map(comparableCitationText)
    .filter(Boolean);
}

function evidencedBusinessAbsence(
  directAbsence: RegExp,
  evidence: Candidate['evidence'],
  sources: readonly FactSourceText[],
) {
  return citationsByDocument(evidence).some(({ documentId, quotes }) => {
    const documents = sources.filter(
      (source) => source.documentId === documentId,
    );
    const statements = documents.length
      ? documents.flatMap(({ text }) => businessStatements(text))
      : quotes.flatMap(businessStatements);
    const hasCitation = (part: string) =>
      quotes.some((quote) => citationContainsValue(part, quote));
    if (
      statements.some(
        (statement) => directAbsence.test(statement) && hasCitation(statement),
      )
    )
      return true;
    const clauses = statements.flatMap((statement) => {
      const clauses = statement.split(/\s*(?:,|;|\s+и\s+)\s*/u);
      return clauses.every(
        (clause) =>
          noBusinessActivity.test(clause) || noBusinessStatus.test(clause),
      )
        ? clauses
        : [];
    });
    return quotes.some(
      (quote) =>
        clauses.some(
          (clause) =>
            noBusinessActivity.test(clause) &&
            citationContainsValue(clause, quote),
        ) &&
        clauses.some(
          (clause) =>
            noBusinessStatus.test(clause) &&
            citationContainsValue(clause, quote),
        ),
    );
  });
}

function supportedValue(
  candidate: Candidate,
  definition: FieldDefinition | undefined,
  requireText: boolean,
  sources: readonly FactSourceText[] = [],
): FieldValue {
  const { field, value } = candidate;
  if (typeof value === 'string') {
    if (field === 'citizenship')
      return candidate.evidence.some(
        ({ imagePath, quote }) =>
          imagePath === null && hasRussianPassportCitizenship(value, quote),
      )
        ? 'Российская Федерация'
        : null;
    const matches =
      typedEvidence(definition) ?? (requireText ? mentions : undefined);
    return matches &&
      !proofLines(candidate.evidence).some((quote) => matches(value, quote))
      ? null
      : value;
  }
  if (!Array.isArray(value)) return value;
  if (field === 'realEstate')
    return evidencedProperty(value, candidate.evidence, sources) ? value : null;
  const directAbsence = businessAbsenceRule(field);
  if (directAbsence && !value.length)
    return evidencedBusinessAbsence(directAbsence, candidate.evidence, sources)
      ? value
      : null;
  if (field === 'attachments' && value.some(({ category }) => !!category))
    return null;
  if (employmentFields.some((key) => key === field))
    return evidencedEmployment(candidate, value);
  if (
    obligationFields.some((key) => key === field) &&
    value.some(isBankObligation)
  ) {
    const row = value.length === 1 ? value[0] : undefined;
    return row
      ? evidencedObligation(candidate.evidence, row, requireText, definition)
      : null;
  }
  const identity = fieldIdentity(field);
  const lines = proofLines(candidate.evidence);
  const supported = value.every((row) => {
    const markers = identity.flatMap((column) => {
      const marker = row[column]?.trim();
      return marker ? [marker] : [];
    });
    const matching = markers.length
      ? lines.filter((line) =>
          markers.every((marker) => mentions(line, marker)),
        )
      : lines;
    return Object.entries(row).every(([column, cell]) => {
      if (cell === null) return true;
      if (Object.hasOwn(creditorRegistryColumns, column)) return false;
      const columnDefinition = definition?.columns.find(
        ({ key }) => key === column,
      );
      const matches = typedEvidence(columnDefinition);
      return matches
        ? matching.some((line) => matches(cell, line))
        : !requireText || matching.some((line) => mentions(line, cell));
    });
  });
  return supported ? value : null;
}

function evidencedEmployment(
  candidate: Candidate,
  rows: FieldRow[],
): FieldValue {
  const documentIds = new Set(
    candidate.evidence.map(({ documentId }) => documentId),
  );
  const documents = [...documentIds].map((id) =>
    proofLines(
      candidate.evidence.filter(({ documentId }) => documentId === id),
      true,
    ),
  );
  if (!rows.length) return rows;
  const supported = rows.every((row) => {
    const employer = row.employer?.trim();
    if (!employer) return false;
    const employerSources = documents.filter((lines) =>
      lines.some((line) => mentions(line, employer)),
    );
    if (candidate.field === 'employmentHistory') {
      const date = canonicalCalendarDate(row.date ?? '');
      const event = row.event;
      const pattern =
        event === employmentEvents.hired
          ? /(?<![\p{L}])(?:при[её]м|принят[ао]?|назначен[ао]?)(?![\p{L}])/iu
          : event === employmentEvents.terminated
            ? /(?<![\p{L}])(?:увольнение|уволен[ао]?|трудов[а-я]+ договор (?:расторгнут|прекращ[её]н))(?![\p{L}])/iu
            : null;
      return (
        !!date &&
        !!pattern &&
        employerSources.some((lines) =>
          lines.some((line) => pattern.test(line) && attestedDate(date, line)),
        )
      );
    }
    const month = employmentMonth(row.month ?? '');
    const amount = canonicalMoneyAmount(row.amount ?? '');
    const code = row.code?.trim() || null;
    const sourceLine = row.sourceLine?.trim();
    return (
      !!month &&
      !!amount &&
      !amount.startsWith('-') &&
      (code === null || /^\d{4}$/u.test(code)) &&
      employerSources.some((lines) =>
        evidencedIncomeMonth(lines, month, amount, code, sourceLine),
      )
    );
  });
  return supported ? rows : null;
}

function evidencedIncomeMonth(
  lines: string[],
  month: string,
  amount: string,
  code: string | null,
  sourceLine?: string,
) {
  const year = month.slice(0, 4);
  const number = String(Number(month.slice(5)));
  const yearHeader = new RegExp(
    String.raw`(?:^\s*${year}\s*$|(?<!\d)${year}\s*(?:год|г\.)|год\s*[:=]\s*${year}(?!\d))`,
    'iu',
  );
  const monthLabel = new RegExp(
    String.raw`^\s*(?:\|\s*)?(?:месяц\s*[:=]?\s*)?0?${number}(?=\s|[|:;])`,
    'iu',
  );
  const fullMonth = new RegExp(String.raw`(?<!\d)${month}(?![-\d])`, 'u');
  const hasYear = lines.some((line) => yearHeader.test(line));
  return lines.some((line) => {
    if (sourceLine && line.trim() !== sourceLine) return false;
    const date =
      fullMonth.exec(line) ?? (hasYear ? monthLabel.exec(line) : null);
    if (!date) return false;
    const payment = line.slice(date.index + date[0].length);
    if (code === null) return attestedAmount(amount, payment);
    const codeCell = new RegExp(
      String.raw`^\s*(?:[|;:]\s*)?${code}(?=\s|[|;:])`,
      'u',
    ).exec(payment);
    return (
      codeCell !== null &&
      moneyAmountsInText(
        payment
          .slice(codeCell[0].length)
          .replace(/^\s*[|;:]\s*/u, '')
          .split(/[|;]/u, 1)[0] ?? '',
      )[0] === amount
    );
  });
}

/** The caller supplies evidence from one document. */
export function evidencedContract(
  evidence: Candidate['evidence'],
  { name, contractNumber, contractDate }: FieldRow,
) {
  if (!name || !contractNumber || !contractDate) return;
  const lines = proofLines(evidence, true);
  const number = contractNumber
    .trim()
    .replace(/^№\s*/, '')
    .normalize('NFKC')
    .toLowerCase();
  if (!lines.some((line) => mentions(line, name))) return;
  const matches = evidence.flatMap((entry) =>
    contractTypeCitations(proofLines([entry], true), number, contractDate),
  );
  if (matches.length)
    return {
      lines,
      typeCitations: matches,
      identity: { name, contractNumber, contractDate },
    };
}

function contractTypeCitations(
  quote: string[],
  number: string,
  contractDate: string,
) {
  const clauses = quote.flatMap((line) => line.split(';'));
  return clauses.flatMap((line, index) => {
    const numberToken = [
      ...line.matchAll(/[\p{L}\p{N}]+(?:[-/._][\p{L}\p{N}]+)*/gu),
    ].find(([token]) => token.normalize('NFKC').toLowerCase() === number);
    if (!numberToken) return [];
    const directlyDated = attestedDate(contractDate, line);
    const nextDate = /^\s*дата\s+(?:заключения\s+)?договора\s*:\s*(.+)$/iu.exec(
      clauses[index + 1] ?? '',
    )?.[1];
    const labelledDate = canonicalCalendarDate(nextDate ?? '');
    const hasLabeledDate =
      /^\s*номер\s+договора\s*:\s*№?\s*\S+\s*$/iu.test(line) &&
      labelledDate !== undefined &&
      labelledDate === canonicalCalendarDate(contractDate);
    if (!directlyDated && !hasLabeledDate) return [];
    const prefix = line.slice(0, numberToken.index);
    // Ignore clauses before this number when they already refer to another document.
    const title = prefix.replace(/№\s*$/u, '');
    const boundTitle =
      /№/u.test(title) || datesInText(title).length ? '' : title;
    const detail = clauses[index + (hasLabeledDate ? 2 : 1)] ?? '';
    const type =
      /^\s*(?:вид|тип|продукт)(?:\s+(?:договора|обязательства|кредита|продукта))?\s*:\s*([^№]+)$/iu.exec(
        detail,
      )?.[1];
    return type &&
      !line.slice(numberToken.index + numberToken[0].length).includes('№')
      ? [boundTitle, type]
      : [boundTitle];
  });
}

function fullDebtAmount(line: string) {
  const total =
    /(?:общая|полная|итоговая)\s+(?:сумма\s+)?задолженность|(?:сумма|размер)\s+(?:общей\s+|полной\s+)?задолженности|задолженность\s*\(?всего\)?|^\s*задолженность\s*:/i.exec(
      line,
    );
  if (!total) return undefined;
  const tail =
    line
      .slice(total.index + total[0].length)
      .replace(/^\s*\|\s*/, '')
      .split(/[;|]/, 1)[0] ?? '';
  const withoutDates = datesInText(tail).reduce(
    (result, date) => result.replace(date, ' '),
    tail,
  );
  return moneyAmountsInText(withoutDates)[0];
}

function balanceDates(lines: string[]) {
  return new Set(
    lines.flatMap((line) =>
      line
        .split(
          /(?:по состоянию на|на дату расч[её]та|дата расч[её]та)\s*[:—-]?\s*/iu,
        )
        .slice(1)
        .flatMap((section) => {
          const [date] = datesInText(section);
          const canonical = date && canonicalCalendarDate(date);
          return canonical ? [canonical] : [];
        }),
    ),
  );
}

function contractLines(lines: string[], number: string) {
  const clauses = lines.flatMap((line) =>
    line.split(/;\s*|(?<=\.)\s+(?=\p{Lu})/u),
  );
  const references = clauses.map((line) =>
    [
      ...line.matchAll(
        /(?:номер\s+договора\s*:\s*№?\s*|договор[а-яё]*\s+(?:[\p{L}-]+\s+){0,4}№\s*)([\p{L}\p{N}]+(?:[-/._][\p{L}\p{N}]+)*)|договор[а-яё]*\s+(?:[а-яё-]+\s+){0,4}((?=[\p{L}\p{N}/._-]*\d)[\p{L}\p{N}]+(?:[-/._][\p{L}\p{N}]+)*)/giu,
      ),
    ].flatMap(([, labelled, bare]) => {
      const id =
        labelled ?? (bare && !canonicalCalendarDate(bare) ? bare : undefined);
      return id ? [id.normalize('NFKC').toLowerCase()] : [];
    }),
  );
  if (references.every((ids) => ids.every((id) => id === number)))
    return { heading: [], block: clauses };
  let within = false;
  const block = clauses.filter((_, index) => {
    const ids = references[index] ?? [];
    if (ids.length) within = ids.every((id) => id === number);
    return within;
  });
  return {
    heading: clauses.slice(
      0,
      references.findIndex((ids) => ids.length),
    ),
    block,
  };
}

export interface FactSourceText {
  documentId: string;
  text: string;
}

/**
 * A later source can block an old balance even when extraction proposed no usable
 * candidate. Only explicitly dated statements with a proven contract identity count.
 */
export function debtSourceChecks(sources: readonly FactSourceText[]) {
  const statements = sources.map(({ documentId, text }) => {
    const lines = sourceLines(text);
    return {
      documentId,
      lines,
      certificate: lines.some((line) =>
        /справка\s+о\s+(?:размере\s+|сумме\s+|наличии\s+|состоянии\s+|погашении\s+)?задолженности/iu.test(
          line,
        ),
      ),
    };
  });
  const forContract = (
    { name, contractNumber, contractDate }: FieldRow,
    ids?: ReadonlySet<string>,
  ) => {
    if (!name || !contractNumber || !contractDate) return [];
    const number = contractNumber
      .trim()
      .replace(/^№\s*/u, '')
      .normalize('NFKC')
      .toLowerCase();
    return statements.flatMap(({ documentId, lines, certificate }) => {
      if (
        (ids && !ids.has(documentId)) ||
        !lines.some((line) => mentions(line, name)) ||
        !contractTypeCitations(lines, number, contractDate).length
      )
        return [];
      const { heading, block } = contractLines(lines, number);
      const dates = balanceDates(block);
      return [
        {
          block,
          dates: dates.size ? dates : balanceDates(heading),
          certificate,
        },
      ];
    });
  };
  return {
    hasNewerBalance(row: FieldRow) {
      const date = canonicalCalendarDate(row.amountDate ?? '');
      if (!date) return false;
      const iso = formatCalendarDate(date, 'YYYY-MM-DD');
      return forContract(row).some(
        ({ block, dates, certificate }) =>
          (certificate ||
            block.some(
              (line) =>
                fullDebtAmount(line) !== undefined ||
                obligationStatus(obligationStatuses.closed)?.test(line) ||
                obligationStatus(obligationStatuses.repaid)?.test(line),
            )) &&
          [...dates].some(
            (observed) => formatCalendarDate(observed, 'YYYY-MM-DD') > iso,
          ),
      );
    },
    supportsBalance(row: FieldRow, evidence: Candidate['evidence']) {
      const date = canonicalCalendarDate(row.amountDate ?? '');
      if (!date) return false;
      const ids = new Set(evidence.map(({ documentId }) => documentId));
      return forContract(row, ids).some(
        ({ block, dates }) =>
          (dates.size
            ? dates.size === 1 && dates.has(date)
            : block.some((line) => attestedDate(date, line))) &&
          provesBalance(row, block),
      );
    },
  };
}

/** A balance can outrank another only if its date and amount are unambiguous in the cited material. */
export function hasUnambiguousBalanceDate(
  evidence: Candidate['evidence'],
  row: FieldRow,
) {
  return [...new Set(evidence.map(({ documentId }) => documentId))].some(
    (id) => {
      const contract = evidencedContract(
        evidence.filter(({ documentId }) => documentId === id),
        row,
      );
      if (!contract) return false;
      const dates = balanceDates(contract.lines);
      const amounts = new Set(
        contract.lines.map(fullDebtAmount).filter(Boolean),
      );
      const numbers = new Set(
        contract.lines.flatMap((line) =>
          [
            ...line.matchAll(
              /договор[а-яё]*\s+№\s*([\p{L}\p{N}]+(?:[-/._][\p{L}\p{N}]+)*)/giu,
            ),
          ].map(([, number]) => number?.normalize('NFKC').toLowerCase()),
        ),
      );
      return (
        numbers.size <= 1 &&
        dates.size === 1 &&
        dates.has(canonicalCalendarDate(row.amountDate ?? '') ?? '') &&
        amounts.size === 1 &&
        amounts.has(canonicalMoneyAmount(row.amount ?? ''))
      );
    },
  );
}

function obligationStatus(debtStatus: FieldRow[string]) {
  return debtStatus === obligationStatuses.closed
    ? /^\s*(?:(?:кредитный\s+договор|договор|кредит)\s+(?:был\s+)?закрыт|действие\s+договора\s+прекращено)\.?\s*$/iu
    : debtStatus === obligationStatuses.repaid
      ? /^\s*(?:(?:кредит|долг)\s+(?:был\s+)?полностью\s+погашен|задолженность\s+(?:полностью\s+погашена|отсутствует)|обязательства\s+(?:по\s+кредитному\s+договору\s+)?исполнены\s+в\s+полном\s+объ[её]ме)\.?\s*$/iu
      : null;
}

function provesBalance(row: FieldRow, lines: string[]) {
  if (row.debtStatus !== obligationStatuses.active) {
    const status = obligationStatus(row.debtStatus ?? null);
    return (
      row.amount == null &&
      status !== null &&
      lines.some((line) => status.test(line))
    );
  }
  const amount = canonicalMoneyAmount(row.amount ?? '');
  const observed = new Set(lines.map(fullDebtAmount).filter(Boolean));
  return (
    amount !== undefined &&
    amount !== '0.00' &&
    !amount.startsWith('-') &&
    observed.size === 1 &&
    observed.has(amount)
  );
}

function evidencedObligation(
  evidence: Candidate['evidence'],
  row: FieldRow,
  requireText: boolean,
  definition: FieldDefinition | undefined,
): FieldValue {
  const { contractDate, amountDate, contractNumber } = row;
  if (!contractDate || !amountDate || !contractNumber) return null;
  const documentIds = [
    ...new Set(evidence.map(({ documentId }) => documentId)),
  ];
  const sameContract = documentIds.flatMap((id) => {
    const contract = evidencedContract(
      evidence.filter(({ documentId }) => documentId === id),
      row,
    );
    return contract?.lines.some((line) => attestedDate(amountDate, line))
      ? [contract]
      : [];
  });
  const number = contractNumber
    .trim()
    .replace(/^№\s*/u, '')
    .normalize('NFKC')
    .toLowerCase();
  const credible = sameContract.find(({ lines }) =>
    provesBalance(row, contractLines(lines, number).block),
  );
  if (!credible) return null;
  if (
    row.type != null &&
    row.type !== evidencedObligationType(credible.typeCitations)
  )
    return null;
  const supported = Object.entries(row).every(([column, cell]) => {
    if (cell == null) return true;
    if (Object.hasOwn(creditorRegistryColumns, column)) return false;
    if (
      [
        'name',
        'type',
        'contractNumber',
        'contractDate',
        'amountDate',
        'debtStatus',
        'amount',
      ].includes(column)
    )
      return true;
    const matches = typedEvidence(
      definition?.columns.find(({ key }) => key === column),
    );
    return matches
      ? credible.lines.some((line) => matches(cell, line))
      : !requireText || credible.lines.some((line) => mentions(line, cell));
  });
  return supported ? [row] : null;
}
