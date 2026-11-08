import { expect, test } from 'bun:test';

import { renderToStaticMarkup } from 'react-dom/server';

import { SessionContext } from '@/features/works/session-context';

test('shows persisted context and explicitly warns after the underlying work changes', () => {
  const html = renderToStaticMarkup(
    <SessionContext
      revision={3}
      fields={[]}
      session={{
        id: crypto.randomUUID(),
        revision: 1,
        updatedAt: new Date().toISOString(),
        context: {
          version: 1,
          workRevision: 2,
          inputRevision: 1,
          settingsRevision: 1,
          promptVersion: 'work-context-v1',
          summary: 'Получен первый документ',
          documents: [],
          missingFields: ['birthDate'],
          conflictFields: ['lastName'],
        },
      }}
    />,
  );
  expect(html).toContain('Получен первый документ');
  expect(html).toContain('будет обновлён');
  expect(html).toContain('Требуют проверки');
  expect(html).toContain('Не заполнены');
});
