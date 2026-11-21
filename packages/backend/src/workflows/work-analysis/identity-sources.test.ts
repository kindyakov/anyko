import { expect, test } from 'bun:test';

import {
  passportCitizenshipCandidates,
  passportSourceIds,
} from './identity-sources';

test('identifies a passport spread without mistaking a certificate containing its details for the passport', () => {
  expect(
    passportSourceIds([
      {
        id: 'certificate',
        text: 'Справка о задолженности\nПаспорт: 00 00 № 000000\nПаспорт выдан: МВД России\nКод подразделения: 000-000',
      },
      {
        id: 'passport',
        text: 'РОССИЙСКАЯ ФЕДЕРАЦИЯ\nФамилия\nИВАНОВ\nИмя ИВАН\nМесто рождения ГОР. КИРОВ',
      },
    ]),
  ).toEqual(new Set(['passport']));
});

test('reads citizenship as a direct passport fact with an exact citation', () => {
  const heading = 'Паспорт гражданина Российской Федерации';
  expect(
    passportCitizenshipCandidates([
      { id: 'passport', text: heading },
      { id: 'certificate', text: `К документам приложен ${heading}` },
    ]),
  ).toEqual([
    {
      field: 'citizenship',
      value: 'Российская Федерация',
      origin: 'document',
      evidence: [{ documentId: 'passport', imagePath: null, quote: heading }],
    },
  ]);
});
