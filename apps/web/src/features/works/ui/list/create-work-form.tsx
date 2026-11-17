'use client';
import { ArrowRight, FolderKanban } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { RefObject } from 'react';
import { z } from 'zod';

import type { DocumentPackage } from '@anyko/contracts/catalog';
import { Button } from '@anyko/ui';
import { FormErrorNotice, FormRoot, useAppForm } from '@anyko/ui/form';

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
}: {
  create: ReturnType<typeof useCreateWork>;
  packages: readonly DocumentPackage[];
  titleRef: RefObject<HTMLInputElement | null>;
  onCancel: () => void;
}) {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  // Повтор отправки после неизвестного исхода (сетевая ошибка) передаёт тот же ключ.
  const idempotency = useIdempotencyKey();
  const form = useAppForm({
    defaultValues: { title: '', packageVersion: packages[0]?.version ?? '' },
    onSubmit: async ({ value, formApi }) => {
      try {
        const result = await create.mutateAsync({
          ...value,
          idempotencyKey: idempotency.take(),
        });
        idempotency.settle();
        router.push(routes.work(workspaceId, result.work.id));
      } catch (error) {
        idempotency.settle(error);
        applyServerErrors(formApi, error, createWorkTexts);
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
