import { debtAttachmentDescription } from '@anyko/document-values/attachments';
import {
  obligationFields,
  obligationStatuses,
} from '@anyko/document-values/obligations';

import type { WorkFacts } from '../../modules/facts';
import { russianPassportCitation } from '../../profiles/bfl/passport-evidence';

import type { ChecklistAnalysisSource } from './checklist-suggestions';
import { locateEvidence } from './locate-evidence';

type Candidate = WorkFacts['candidates'][number];

const documentTitles = [
  {
    pattern:
      /(?:форма\s+ади\\?[-‐‑–]рег|сведения о регистрации индивидуального лицевого сч[её]та|уведомление о регистрации в системе индивидуального[^\n]{0,50}уч[её]та|свидетельство[^\n]{0,75}пенсионн[а-яё]+ страховани[а-яё]+)/iu,
    description:
      'Документ о регистрации в системе индивидуального пенсионного учёта (СНИЛС)',
    category: 'other',
  },
  {
    pattern: /свидетельство\s+о\s+постановке\s+на\s+уч[её]т/iu,
    description: 'Свидетельство о постановке на учёт в налоговом органе (ИНН)',
    category: 'other',
  },
  {
    pattern: /сведения о трудовой деятельности|трудовая книжка/iu,
    description: 'Сведения о трудовой деятельности',
    category: 'other',
  },
  {
    pattern: /сведения о состоянии индивидуального лицевого сч[её]та/iu,
    description:
      'Сведения о состоянии индивидуального лицевого счёта застрахованного лица',
    category: 'pensionAccount',
  },
  {
    pattern: /справка о доходах и суммах налога физического лица/iu,
    description: 'Справка о доходах и суммах налога физического лица',
    category: 'other',
  },
  {
    pattern:
      /выписка из единого государственного реестра недвижимости|выписка из егрн/iu,
    description: 'Выписка из Единого государственного реестра недвижимости',
    category: 'egrn',
  },
] as const;

function sourceTitleCandidates(
  sources: readonly ChecklistAnalysisSource[],
): Candidate[] {
  return sources.flatMap(({ id, text }) => {
    // Use headings, so a reference to an attached document cannot classify this one.
    const header = text
      .split(/\r?\n/u)
      .filter((line) => line.trim())
      .slice(0, 6)
      .join('\n');
    const title = documentTitles.find(({ pattern }) => pattern.test(header));
    const passport = russianPassportCitation(text);
    const quote = passport ?? title?.pattern.exec(header)?.[0];
    const description = passport
      ? 'Паспорт гражданина Российской Федерации'
      : title?.description;
    return description && quote
      ? [
          {
            field: 'attachments',
            value: [{ category: title?.category ?? 'other', description }],
            origin: 'document',
            evidence: [{ documentId: id, imagePath: null, quote }],
          },
        ]
      : [];
  });
}

function debtSourceCandidates(candidates: readonly Candidate[]): Candidate[] {
  const bySource = new Map<
    string,
    {
      descriptions: Set<string>;
      evidence: Candidate['evidence'];
    }
  >();
  for (const { field, value, evidence, origin } of candidates) {
    if (
      origin === 'inference' ||
      !Array.isArray(value) ||
      !obligationFields.some((key) => key === field)
    )
      continue;
    const source = evidence[0];
    if (
      !source ||
      !evidence.every((entry) => entry.documentId === source.documentId)
    )
      continue;
    for (const row of value) {
      if (row.debtStatus && row.debtStatus !== obligationStatuses.active)
        continue;
      const description = debtAttachmentDescription(row);
      if (!description) continue;
      const existing = bySource.get(source.documentId);
      if (existing) {
        if (existing.descriptions.has(description)) continue;
        existing.descriptions.add(description);
        existing.evidence = [...existing.evidence, ...evidence].slice(0, 12);
      } else
        bySource.set(source.documentId, {
          descriptions: new Set([description]),
          evidence,
        });
    }
  }
  return [...bySource.values()].map(({ descriptions, evidence }) => ({
    field: 'attachments',
    value: [
      {
        category: 'debtCertificate',
        description: [...descriptions].join('; ').slice(0, 4000),
      },
    ],
    origin: 'document',
    evidence,
  }));
}

export function supportingAttachmentCandidates(
  candidates: readonly Candidate[],
  sources: ChecklistAnalysisSource[],
) {
  return [
    ...debtSourceCandidates(candidates),
    ...locateEvidence(sourceTitleCandidates(sources), sources),
  ];
}
