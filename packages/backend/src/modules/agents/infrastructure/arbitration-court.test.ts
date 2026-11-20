import { expect, test } from 'bun:test';

import { findArbitrationCourt } from './arbitration-court';

test('uses the official territorial catalogue and reads the current address from the selected court', async () => {
  const requests: string[] = [];
  const fetchPage = (url: string) => {
    requests.push(url);
    if (url === 'https://arbitr.ru/ac/map')
      return Promise.resolve(
        Response.json([
          {
            ac1: [
              {
                name: 'Арбитражный суд города Москвы',
                s_name: 'города Москвы',
                cityname: 'Москва',
                region_type: 4,
                url: 'http://msk.arbitr.ru',
              },
              {
                name: 'Арбитражный суд Московской области',
                s_name: 'Московской области',
                cityname: 'Москва',
                region_type: 3,
                url: 'http://asmo.arbitr.ru',
                address1: 'Устаревший адрес',
              },
            ],
          },
        ]),
      );
    return Promise.resolve(
      new Response(`<div class="info-page__text"><table><tr>
      <td><strong>Адрес:</strong></td><td>107053, Москва,&nbsp;пр-кт Академика Сахарова, 18</td>
    </tr><tr><td>Адрес местонахождения суда:</td><td>г. Москва, пр-кт Академика Сахарова, 18</td></tr></table></div>`),
    );
  };

  const result = await findArbitrationCourt(
    'Московская область',
    new AbortController().signal,
    fetchPage,
  );

  expect(requests).toEqual([
    'https://arbitr.ru/ac/map',
    'https://asmo.arbitr.ru/about/mode',
  ]);
  expect(result).toMatchObject({
    status: 'found',
    courts: [
      {
        name: 'Арбитражный суд Московской области',
        addresses: ['107053, Москва, пр-кт Академика Сахарова, 18'],
        contactUrl: 'https://asmo.arbitr.ru/about/mode',
      },
    ],
  });
});

test('cancels an oversized streamed catalogue response before reading its remainder', async () => {
  let cancelled = false;
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++;
      if (pulls === 5) controller.close();
      else controller.enqueue(new Uint8Array(1_000_001));
    },
    cancel() {
      cancelled = true;
    },
  });
  const result = await findArbitrationCourt(
    'Московская область',
    new AbortController().signal,
    () => Promise.resolve(new Response(body)),
  );
  expect(result).toMatchObject({ status: 'unavailable', courts: [] });
  expect(cancelled).toBe(true);
  expect(pulls).toBeLessThan(5);
});
