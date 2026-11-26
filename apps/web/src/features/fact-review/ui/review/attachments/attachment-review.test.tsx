import { expect, mock, test } from 'bun:test';

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { WorkView } from '@anyko/contracts/works';

import { AttachmentReview } from './attachment-review';

test('a visible stamp leaves the file unselected until the lawyer chooses the copy type', async () => {
  const document = {
    id: 'approved-file',
    filename: 'Справка.pdf',
    status: 'succeeded',
    createdAt: '2026-11-20T12:00:00Z',
  } as const;
  const candidates: WorkView['facts']['candidates'] = [
    {
      field: 'attachments',
      value: [{ description: 'Справка', category: 'other' }],
      selected: false,
      evidence: [
        { documentId: document.id, imagePath: null, quote: 'Справка' },
      ],
    },
    {
      field: 'attachments',
      value: [
        { description: 'Справка с печатью от 20.11.2026', category: 'other' },
      ],
      selected: false,
      evidence: [
        {
          documentId: document.id,
          imagePath: null,
          quote: 'Справка с печатью от 20.11.2026',
          page: 2,
        },
      ],
    },
  ];
  const change = mock();
  const open = mock();
  const input = {
    documents: [document],
    candidates,
    disabled: false,
    onChange: change,
    onOpen: open,
  };
  const { rerender } = render(<AttachmentReview {...input} value={null} />);
  const user = userEvent.setup();
  const openAttachments = () =>
    user.click(screen.getByRole('button', { name: /Приложения/u }));
  expect(screen.queryByRole('combobox')).toBeNull();
  await openAttachments();
  const preferred = /Справка с печатью от 20\.11\.2026/u;
  expect(screen.getByRole('button', { name: /^Справка ·/u })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: preferred }));
  fireEvent.click(screen.getByRole('button', { name: 'Справка.pdf' }));
  expect(open).toHaveBeenCalledWith(document, 2);
  await openAttachments();
  const choice = screen.getByRole('combobox', {
    name: 'Вид подаваемого экземпляра для Справка.pdf',
  });
  const choose = async (label: string) => {
    await user.click(choice);
    await user.click(await screen.findByRole('option', { name: label }));
  };
  expect(choice.textContent).toContain('Не подавать');
  expect(change).not.toHaveBeenCalled();
  await choose('Копия');
  const selected = [
    {
      documentId: document.id,
      description: 'Справка с печатью от 20.11.2026',
      category: 'other',
      copyKind: 'copy',
    },
  ];
  expect(change).toHaveBeenLastCalledWith(selected);

  rerender(<AttachmentReview {...input} value={selected} />);
  expect(choice.textContent).toContain('Копия');
  await choose('Бумажный оригинал');
  expect(change).toHaveBeenLastCalledWith([
    { ...selected[0], copyKind: 'paperOriginal' },
  ]);
  await choose('Не подавать');
  expect(change).toHaveBeenLastCalledWith([]);
});

test('includes the generated inventory without a source file', async () => {
  const change = mock();
  render(
    <AttachmentReview
      documents={[]}
      candidates={[]}
      disabled={false}
      onChange={change}
      onOpen={mock()}
      value={null}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Приложения/u }));
  await user.click(
    screen.getByRole('combobox', {
      name: /Вид подаваемого экземпляра для Опись имущества/u,
    }),
  );
  expect(change).not.toHaveBeenCalled();
  await user.click(await screen.findByRole('option', { name: 'Оригинал' }));
  expect(change).toHaveBeenLastCalledWith([
    {
      documentId: 'package:inventory',
      description:
        'Опись имущества гражданина по форме, утверждённой Приказом Минэкономразвития России от 05.08.2015 № 530',
      category: 'other',
      copyKind: 'paperOriginal',
    },
  ]);
});
