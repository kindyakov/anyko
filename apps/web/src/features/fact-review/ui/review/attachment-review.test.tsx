import { expect, mock, test } from 'bun:test';

import { fireEvent, render, screen } from '@testing-library/react';

import type { WorkView } from '@anyko/contracts/works';

import { AttachmentReview } from './attachment-review';

test('a visible stamp leaves the file unselected until the lawyer chooses the copy type', () => {
  const document = {
    id: 'approved-file',
    filename: 'Справка.pdf',
    status: 'succeeded',
    createdAt: '2026-11-20T12:00:00Z',
  } as const;
  const candidates: WorkView['facts']['candidates'] = [
    {
      field: 'attachments',
      value: [{ description: 'Справка с печатью', category: 'other' }],
      selected: false,
      evidence: [
        {
          documentId: document.id,
          imagePath: null,
          quote: 'Справка с печатью',
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
  const choice = screen.getByRole('combobox', {
    name: 'Вид подаваемого экземпляра для Справка.pdf',
  });
  expect(choice).toHaveProperty('value', '');
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Справка.pdf' }));
  expect(open).toHaveBeenCalledWith(document, 2);
  fireEvent.change(choice, { target: { value: 'copy' } });
  const selected = [
    {
      documentId: document.id,
      description: 'Справка с печатью',
      category: 'other',
      copyKind: 'copy',
    },
  ];
  expect(change).toHaveBeenLastCalledWith(selected);

  rerender(<AttachmentReview {...input} value={selected} />);
  expect(choice).toHaveProperty('value', 'copy');
  fireEvent.change(choice, { target: { value: 'paperOriginal' } });
  expect(change).toHaveBeenLastCalledWith([
    { ...selected[0], copyKind: 'paperOriginal' },
  ]);
  fireEvent.change(choice, { target: { value: '' } });
  expect(change).toHaveBeenLastCalledWith([]);
});
