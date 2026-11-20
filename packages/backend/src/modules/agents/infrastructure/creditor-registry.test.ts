import { expect, test } from 'bun:test';

import { findCreditor } from './creditor-registry';

const signal = new AbortController().signal;

test('looks up a financial organisation by INN and returns only public legal entity details', async () => {
  const calls: string[] = [];
  const result = await findCreditor(
    { source: 'cbr', inn: '9703026898' },
    signal,
    (url, init) => {
      calls.push(url);
      expect(
        init.body instanceof URLSearchParams
          ? init.body.toString()
          : typeof init.body === 'string'
            ? init.body
            : '',
      ).toContain('<INN>9703026898</INN>');
      return Promise.resolve(
        new Response(
          '<Envelope><GetFullInfoByINNResult><OGRN>1217700060820</OGRN><INN>9703026898</INN><ShortName>ООО МКК «Озон Кредит»</ShortName><Name>Общество с ограниченной ответственностью Микрокредитная компания «Озон Кредит»</Name><Address>Москва, наб. Пресненская, д. 10</Address><Email>ignored</Email></GetFullInfoByINNResult></Envelope>',
        ),
      );
    },
  );

  expect(calls).toEqual(['https://www.cbr.ru/FO_ZoomWS/FinOrg.asmx']);
  expect(result).toMatchObject({
    status: 'found',
    organisations: [
      {
        fullName:
          'Общество с ограниченной ответственностью Микрокредитная компания «Озон Кредит»',
        shortName: 'ООО МКК «Озон Кредит»',
        address: 'Москва, наб. Пресненская, д. 10',
        inn: '9703026898',
        ogrn: '1217700060820',
        url: 'https://www.cbr.ru/finorg/foinfo/?ogrn=1217700060820',
      },
    ],
  });
  expect(result.organisations[0]).not.toHaveProperty('email');
  expect(Date.parse(result.checkedAt)).not.toBeNaN();
});

test('keeps two matching legal entities available and reads the official EGRUL address for each', async () => {
  const token = 'A'.repeat(64);
  const job = { id: '4dce586d-bcf3-41ee-a32f-f3ba96deff2e' };
  const legalEntities = [
    {
      namep: 'Общество с ограниченной ответственностью «Меридиан»',
      namec: 'ООО «Меридиан»',
      inn: '7707083893',
      ogrn: '1027700132195',
      token,
    },
    {
      namep: 'Общество с ограниченной ответственностью «Меридиан»',
      namec: 'ООО «Меридиан»',
      inn: '9703026898',
      ogrn: '1217700060820',
      token: 'B'.repeat(64),
    },
  ];
  const result = await findCreditor(
    { source: 'fns', name: 'ООО «Меридиан»' },
    signal,
    (url, init) => {
      const body = new URLSearchParams(
        init.body instanceof URLSearchParams
          ? init.body.toString()
          : typeof init.body === 'string'
            ? init.body
            : '',
      );
      if (
        url.endsWith('/search-proc.json') &&
        body.get('mode') === 'search-ul'
      ) {
        expect(body.get('queryUl')).toBe('ООО «Меридиан»');
        return Promise.resolve(Response.json(job));
      }
      if (url.endsWith('/search-proc.json')) {
        expect(body.get('method')).toBe('get-response');
        return Promise.resolve(
          Response.json({ ul: { data: legalEntities, hasMore: false } }),
        );
      }
      const first = body.get('token') === token;
      if (body.get('method') === 'get-request')
        return Promise.resolve(
          Response.json({ ...job, token: body.get('token') }),
        );
      return Promise.resolve(
        Response.json({
          vyp: {
            ИНН: first ? '7707083893' : '9703026898',
            ОГРН: first ? '1027700132195' : '1217700060820',
            КПП: '773601001',
            АдресРФ: first
              ? 'Москва, ул. Первая, д. 10'
              : 'Тула, ул. Вторая, д. 2',
          },
        }),
      );
    },
  );

  expect(result.status).toBe('ambiguous');
  expect(result.organisations).toMatchObject([
    {
      shortName: 'ООО «Меридиан»',
      ogrn: '1027700132195',
      address: 'Москва, ул. Первая, д. 10',
      kpp: '773601001',
    },
    {
      shortName: 'ООО «Меридиан»',
      ogrn: '1217700060820',
      address: 'Тула, ул. Вторая, д. 2',
    },
  ]);
});

test('stops at FNS CAPTCHA and does not report a failed lookup as no match', async () => {
  let requests = 0;
  const result = await findCreditor(
    { source: 'fns', ogrn: '1027700132195' },
    signal,
    (_url, init) => {
      expect(
        init.body instanceof URLSearchParams
          ? init.body.toString()
          : typeof init.body === 'string'
            ? init.body
            : '',
      ).toContain('queryUl=1027700132195');
      requests++;
      return Promise.resolve(
        Response.json({
          id: '4dce586d-bcf3-41ee-a32f-f3ba96deff2e',
          captchaRequired: true,
        }),
      );
    },
  );

  expect(requests).toBe(1);
  expect(result.status).toBe('unavailable');
  expect(result.organisations).toEqual([]);
});
