'use client';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, FolderKanban } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type RefObject, useState } from 'react';
import { z } from 'zod';

import type { DocumentPackage } from '@anyko/contracts/catalog';
import { workSourceLimit } from '@anyko/contracts/works';
import { Button, Notice } from '@anyko/ui';
import { FormErrorNotice, FormRoot, useAppForm } from '@anyko/ui/form';

import {
  CatalogSelection,
  invalidateDocumentCatalog,
  SelectedCatalogFiles,
  unavailableCatalogFiles,
} from '@/features/document-recognition';
import { useCreateWork } from '@/features/works/api/mutations';
import { sharedCodeTexts } from '@/lib/api/errors';
import { applyServerErrors } from '@/lib/api/form-errors';
import { useIdempotencyKey } from '@/lib/api/idempotency';
import { useWorkspaceId } from '@/lib/api/workspace';
import { routes } from '@/lib/routes';

import { Journey } from './journey';

const createFailure = 'Не удалось создать работу. Попробуйте снова.';
const createWorkTexts = {
  codes: sharedCodeTexts,
  fallback: createFailure,
  technical: createFailure,
};

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Введите название работы')
  .max(200, 'Не больше 200 символов');
const packageSchema = z.string().min(1, 'Выберите комплект документов');

export function CreateWorkForm({
  create,
  packages,
  titleRef,
  onCancel,
  allowCatalog,
  initialSelection,
}: {
  create: ReturnType<typeof useCreateWork>;
  packages: readonly DocumentPackage[];
  titleRef: RefObject<HTMLInputElement | null>;
  onCancel: () => void;
  allowCatalog: boolean;
  initialSelection?: ReadonlyMap<string, string> | undefined;
}) {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const client = useQueryClient();
  const [selected, setSelected] = useState(() => new Map(initialSelection));
  const [picking, setPicking] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [requiresReplacement, setRequiresReplacement] = useState(false);
  // Повтор отправки после неизвестного исхода (сетевая ошибка) передаёт тот же ключ.
  const idempotency = useIdempotencyKey();
  const form = useAppForm({
    defaultValues: { title: '', packageVersion: packages[0]?.version ?? '' },
    onSubmit: async ({ value, formApi }) => {
      if (
        selected.size > workSourceLimit ||
        ((initialSelection || requiresReplacement) && !selected.size)
      ) {
        setSelectionError(
          `Выберите от 1 до ${String(workSourceLimit)} файлов.`,
        );
        return;
      }
      const documentIds = [...selected.keys()];
      setSelectionError('');
      try {
        const result = await create.mutateAsync({
          ...value,
          documentIds,
          idempotencyKey: idempotency.take(),
        });
        idempotency.settle();
        onCancel();
        router.push(routes.work(workspaceId, result.work.id));
      } catch (error) {
        idempotency.settle(error);
        const unavailable = unavailableCatalogFiles(
          error,
          documentIds,
          selected,
        );
        if (unavailable) {
          setSelected(unavailable.remaining);
          setRequiresReplacement(true);
          setSelectionError(unavailable.message);
          void invalidateDocumentCatalog(client, workspaceId);
        } else {
          applyServerErrors(formApi, error, createWorkTexts);
        }
      }
    },
  });
  return (
    <FormRoot form={form} className="grid gap-6">
      <form.AppField name="title" validators={{ onChange: titleSchema }}>
        {(field) => (
          <field.TextField
            ref={titleRef}
            label="Название работы"
            required
            maxLength={200}
            placeholder="Например, Иванов И. И. — банкротство"
          />
        )}
      </form.AppField>
      <form.AppField
        name="packageVersion"
        validators={{ onChange: packageSchema }}
      >
        {(field) => (
          <field.RadioGroupField
            label="Комплект документов"
            options={packages.map((pack) => ({
              value: pack.version,
              children: (
                <>
                  <span className="block text-sm font-medium">
                    {pack.title}
                    {pack.technical && (
                      <span className="text-muted ml-2 text-xs font-normal">
                        проверочный бланк
                      </span>
                    )}
                  </span>
                  <span className="text-muted mt-1 block text-xs leading-5">
                    {pack.documents.map((doc) => doc.title).join(' · ')}
                  </span>
                </>
              ),
            }))}
          />
        )}
      </form.AppField>
      {allowCatalog && (
        <section className="grid gap-3" aria-label="Файлы из каталога">
          <Button
            type="button"
            variant="secondary"
            aria-expanded={picking}
            disabled={create.isPending}
            onClick={() => {
              setPicking(!picking);
            }}
          >
            {picking ? 'Скрыть каталог' : 'Выбрать файлы из каталога'}
          </Button>
          {picking && (
            <CatalogSelection
              workspaceId={workspaceId}
              selected={selected}
              setSelected={setSelected}
              disabled={create.isPending}
            />
          )}
          <SelectedCatalogFiles
            selected={selected}
            disabled={create.isPending}
            onRemove={(id) => {
              setSelected((previous) => {
                const next = new Map(previous);
                next.delete(id);
                return next;
              });
            }}
          />
          {selectionError && (
            <Notice tone="danger" role="alert">
              {selectionError}
            </Notice>
          )}
          {requiresReplacement && !initialSelection && !selected.size && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRequiresReplacement(false);
                setSelectionError('');
              }}
            >
              Продолжить без файлов
            </Button>
          )}
        </section>
      )}
      <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
        <p className="text-muted mb-3 flex items-center gap-2 text-xs">
          <FolderKanban size={14} />
          Что будет дальше
        </p>
        <Journey compact />
      </div>
      <FormErrorNotice form={form} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          variant="secondary"
          disabled={create.isPending}
          onClick={onCancel}
        >
          Отмена
        </Button>
        <form.SubmitButton>
          Создать и открыть
          <ArrowRight size={16} />
        </form.SubmitButton>
      </div>
    </FormRoot>
  );
}
