import { expect, test } from 'bun:test';

import { projectChecklist } from './checklist';

test('checklist shows shared requirements once and only current attached evidence', () => {
  const passport = {
    key: 'passport',
    label: 'Паспорт',
    documentKind: 'passport',
    applicability: 'usual' as const,
  };
  const marriage = {
    key: 'marriage',
    label: 'Свидетельство о заключении брака',
    documentKind: 'marriage',
    applicability: 'conditional' as const,
  };
  const rows = [
    { id: 'combined-file', ocrRevision: 2, deleted: false },
    { id: 'removed-file', ocrRevision: 1, deleted: true },
  ];
  const links = [
    {
      requirementKey: 'passport',
      documentId: 'combined-file',
      ocrRevision: 1,
      decision: 'confirmed' as const,
      quote: 'Цитата из старого распознавания',
      page: 1,
    },
    {
      requirementKey: 'marriage',
      documentId: 'removed-file',
      ocrRevision: 1,
      decision: 'found' as const,
      quote: 'Запись о браке',
      page: 2,
    },
  ];

  expect(projectChecklist([passport, passport, marriage], links, rows)).toEqual(
    [
      {
        ...passport,
        status: 'review',
        sources: [
          {
            documentId: 'combined-file',
            status: 'review',
            quote: null,
            page: null,
          },
        ],
      },
      { ...marriage, status: 'clarify', sources: [] },
    ],
  );
});
