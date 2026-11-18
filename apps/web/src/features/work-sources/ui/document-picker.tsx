import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { DocumentSummary } from '@anyko/contracts/documents';
import { workSourceLimit } from '@anyko/contracts/works';
import { Button, Modal, Notice } from '@anyko/ui';

import {
  CatalogSelection,
  describeDocumentError,
  invalidateDocumentCatalog,
  unavailableCatalogFiles,
} from '@/features/document-recognition';
import { useAttachWorkDocuments } from '@/features/works';

export function DocumentPicker({
  workspaceId,
  workId,
  attached,
  onClose,
}: {
  workspaceId: string;
  workId: string;
  attached: readonly DocumentSummary[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [failure, setFailure] = useState('');
  const client = useQueryClient();
  const attach = useAttachWorkDocuments(workspaceId);
  const attachedIds = new Set(attached.map(({ id }) => id));
  const remaining = Math.max(0, workSourceLimit - attachedIds.size);

  function submit() {
    const documentIds = [...selected.keys()];
    setFailure('');
    attach.mutate(
      { workId, documentIds },
      {
        onSuccess: onClose,
        onError: (error) => {
          const unavailable = unavailableCatalogFiles(
            error,
            documentIds,
            selected,
          );
          if (unavailable) {
            setSelected(unavailable.remaining);
            void invalidateDocumentCatalog(client, workspaceId);
          }
          setFailure(unavailable?.message ?? describeDocumentError(error));
        },
      },
    );
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      dismissible={!attach.isPending}
      title="Добавить из каталога"
      description="Выберите файлы с готовым распознаванием."
    >
      <CatalogSelection
        workspaceId={workspaceId}
        selected={selected}
        setSelected={setSelected}
        attached={attachedIds}
        disabled={attach.isPending}
      />
      {failure && (
        <div className="mt-4">
          <Notice role="alert" tone="danger" title="Не удалось добавить файлы">
            {failure}
          </Notice>
        </div>
      )}
      <footer className="mt-5 flex justify-end border-t border-white/10 pt-4">
        <Button
          disabled={!selected.size || selected.size > remaining}
          loading={attach.isPending}
          onClick={submit}
        >
          Добавить файлы
        </Button>
      </footer>
    </Modal>
  );
}
