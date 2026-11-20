'use client';
import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';

import { Button, Modal, Notice, Skeleton } from '@anyko/ui';

import { useCan, useWorkspaceId } from '@/lib/api/workspace';

import { useCreateWork } from '../../api/mutations';
import { documentPackagesQueryOptions } from '../../api/queries';

import { CreateWorkForm } from './create-work-form';

export function CreateWorkDialog({
  onClose,
  initialSelection,
}: {
  onClose: () => void;
  initialSelection?: ReadonlyMap<string, string>;
}) {
  const workspaceId = useWorkspaceId();
  const titleRef = useRef<HTMLInputElement>(null);
  const catalog = useQuery(documentPackagesQueryOptions(workspaceId));
  const packages = catalog.data?.packages ?? [];
  const create = useCreateWork(workspaceId);
  const canUseRecognition = useCan('recognitions.use');
  const canUpload = useCan('documents.upload');
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      dismissible={!create.isPending}
      initialFocus={titleRef}
      title="Новая работа"
      description="Назовите работу и выберите комплект документов, который нужно подготовить."
    >
      {catalog.isPending ? (
        <div className="grid gap-4" aria-busy>
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : catalog.isError ? (
        <Notice
          tone="danger"
          role="alert"
          title="Не удалось загрузить шаблоны"
          action={
            <Button
              variant="secondary"
              size="sm"
              loading={catalog.isFetching}
              onClick={() => {
                void catalog.refetch();
              }}
            >
              Повторить
            </Button>
          }
        />
      ) : !packages.length ? (
        <Notice tone="neutral">
          Доступных комплектов пока нет. Обратитесь к владельцу рабочей области.
        </Notice>
      ) : (
        <CreateWorkForm
          create={create}
          packages={packages}
          titleRef={titleRef}
          onCancel={onClose}
          allowCatalog={canUseRecognition && canUpload}
          initialSelection={initialSelection}
        />
      )}
    </Modal>
  );
}
