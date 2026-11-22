import { expect, test } from 'bun:test';

import { passportSourceIds } from './identity-sources';

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
