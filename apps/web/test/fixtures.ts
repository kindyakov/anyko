import type { Session } from '@anyko/contracts/session';

// Общие данные тестов: рабочая область, работа и её вид проходят схемы contracts.
export const workspaceId = 'workspace-1';
export const workId = '0b6f4e3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
export const workAddress = `/api/v1/workspaces/${workspaceId}/works/${workId}`;

export const session: Session = {
  user: { id: 'user-1', name: 'Test', email: 'user@example.test' },
  memberships: [
    {
      workspace: { id: workspaceId, name: 'Workspace' },
      rights: ['works.read', 'works.edit'],
    },
  ],
};

export const workView = {
  work: {
    id: workId,
    title: 'Работа клиента',
    packageVersion: 'v1',
    revision: 1,
    inputRevision: 0,
    confirmedRevision: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  package: {
    id: 'package-1',
    version: 'v1',
    title: 'Пакет',
    technical: false,
    fields: [],
    documents: [
      {
        id: 'template-1',
        version: 'v1',
        title: 'Шаблон',
        filename: 'template.docx',
        checksum: 'a'.repeat(64),
        blocks: [],
      },
    ],
  },
  documents: [],
  facts: { version: 1, values: {}, manual: [], confirmed: [], candidates: [] },
  runs: [],
  generations: [],
  cursor: '0',
  cleanupPending: false,
};

// Вид работы с другим названием: так тест показывает, что кэш взял ответ сервера заново.
export function titled(title: string) {
  return { ...workView, work: { ...workView.work, title } };
}
