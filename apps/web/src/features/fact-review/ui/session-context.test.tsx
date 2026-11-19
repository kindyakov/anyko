import { expect, test } from 'bun:test';

import { renderToStaticMarkup } from 'react-dom/server';

import { SessionContext } from './session-context';

test.each([
  { reason: 'the work revision changes', revision: 3, sourceIds: [] },
  {
    reason: 'a later source is absent from the summary',
    revision: 2,
    sourceIds: ['new-source'],
  },
])(
  'shows persisted context and warns when $reason',
  ({ revision, sourceIds }) => {
    const view = renderToStaticMarkup(
      <SessionContext
        revision={revision}
        inputRevision={1}
        sourceIds={sourceIds}
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
    expect(view).toContain('Получен первый документ');
    expect(view).toContain('будет обновлён');
    expect(view).toContain('Требуют проверки');
    expect(view).toContain('Не заполнены');
  },
);
