'use client';
import { Field } from '@base-ui/react/field';
import { useQuery } from '@tanstack/react-query';
import { Cpu, Save } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';

import { llmSettingsResponseSchema } from '@anyko/contracts/connections';
import {
  Button,
  Confirm,
  Input,
  Notice,
  Skeleton,
  StatusPill,
} from '@anyko/ui';
import {
  FormErrorNotice,
  FormRoot,
  useAppForm,
  useFormSelector,
  useUnsavedChangesWarning,
} from '@anyko/ui/form';

import {
  useRevokeLlmSettings,
  useSaveLlmSettings,
} from '@/features/connections/api/mutations';
import { llmSettingsQueryOptions } from '@/features/connections/api/queries';
import {
  describeApiError,
  isUnauthorized,
  sharedCodeTexts,
} from '@/lib/api/errors';
import { applyServerErrors } from '@/lib/api/form-errors';
import { useCan, useWorkspaceId } from '@/lib/api/workspace';

type Message = { tone: 'success' | 'danger'; text: string };
type LlmSettings = NonNullable<
  z.infer<typeof llmSettingsResponseSchema>['settings']
>;

const defaultBaseURL = 'https://routerai.ru/api/v1';
const defaultModel = '~deepseek/deepseek-v4-flash-latest';
const saveFailure =
  'Не удалось сохранить настройки. Проверьте адрес, модели и ключ.';

// Подсказки ввода повторяют ограничения contracts (llmSettingsInputSchema); сервер проверяет их снова.
const addressSchema = z
  .string()
  .min(1, 'Введите адрес API')
  .pipe(z.url('Введите адрес в формате https://…'));
const modelSchema = z
  .string()
  .min(1, 'Укажите модель')
  .max(200, 'Не больше 200 символов');

export function ConnectionSettings() {
  const workspaceId = useWorkspaceId();
  // Право только для отображения: форма без него не показывается, а сохранение проверяет API.
  const canManage = useCan('connections.manage');
  const query = useQuery(llmSettingsQueryOptions(workspaceId));
  const [message, setMessage] = useState<Message>();
  const settings = query.data;
  const notice: Message | undefined = query.isError
    ? { tone: 'danger', text: 'Не удалось загрузить настройки модели.' }
    : message;
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <span className="border-brand/30 bg-brand/10 text-brand-hot grid size-11 shrink-0 place-items-center rounded-xl border">
          <Cpu size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Подключение модели</p>
          <p className="text-muted text-xs leading-5">
            OpenAI-совместимый API для анализа изображений и извлечения сведений
          </p>
        </div>
        {settings ? (
          settings.settings ? (
            <StatusPill tone="success">Подключено</StatusPill>
          ) : (
            <StatusPill tone="warning">Не настроено</StatusPill>
          )
        ) : (
          <Skeleton className="h-6 w-24 rounded-full" />
        )}
      </div>
      {!settings && !notice ? (
        <div className="grid gap-5" aria-hidden>
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="grid gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : settings?.canManage && canManage ? (
        <ConnectionForm
          key={settings.settings?.revision ?? 0}
          current={settings.settings}
          onMessage={setMessage}
        />
      ) : settings ? (
        <>
          <ConnectionReadOnly current={settings.settings} />
          <Notice tone="neutral">
            Изменять подключение может владелец рабочей области.
          </Notice>
        </>
      ) : null}
      {notice && (
        <Notice
          tone={notice.tone}
          role={notice.tone === 'danger' ? 'alert' : 'status'}
        >
          {notice.text}
        </Notice>
      )}
    </div>
  );
}

// Без права изменения значения видны только для чтения; ключ API не выводится вовсе.
function ConnectionReadOnly({ current }: { current: LlmSettings | null }) {
  if (!current) return null;
  return (
    <div className="grid gap-5">
      <ReadOnlyField label="Адрес API" value={current.baseURL} />
      <ReadOnlyField
        label="Модель для изображений"
        value={current.visionModel}
      />
      <ReadOnlyField
        label="Модель для извлечения сведений"
        value={current.extractionModel}
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Field.Root className="grid gap-2">
      <Field.Label className="text-[13px] font-medium text-zinc-200">
        {label}
      </Field.Label>
      <Input readOnly value={value} />
    </Field.Root>
  );
}

// Форма создаётся заново при смене версии настроек на сервере (key по revision): значения берутся
// из сохранённой версии, а после успешного сохранения сбрасываются к ней через reset.
function ConnectionForm({
  current,
  onMessage,
}: {
  current: LlmSettings | null;
  onMessage: (message: Message | undefined) => void;
}) {
  const workspaceId = useWorkspaceId();
  const save = useSaveLlmSettings(workspaceId);
  const revoke = useRevokeLlmSettings(workspaceId);
  const [confirming, setConfirming] = useState(false);
  function revokeConnection() {
    onMessage(undefined);
    revoke.mutate(undefined, {
      onSuccess: () => {
        setConfirming(false);
      },
      onError: (error) => {
        setConfirming(false);
        if (isUnauthorized(error)) return;
        onMessage({
          tone: 'danger',
          text: describeApiError(error, {
            codes: sharedCodeTexts,
            fallback: 'Не удалось отозвать подключение. Повторите попытку.',
          }),
        });
      },
    });
  }
  const form = useAppForm({
    defaultValues: {
      baseURL: current?.baseURL ?? defaultBaseURL,
      visionModel: current?.visionModel ?? defaultModel,
      extractionModel: current?.extractionModel ?? defaultModel,
      apiKey: '',
    },
    onSubmit: async ({ value, formApi }) => {
      if (revoke.isPending) return;
      onMessage(undefined);
      const { apiKey, ...settings } = value;
      try {
        // Пустой ключ не отправляется: сервер сохраняет текущий.
        await save.mutateAsync({
          ...settings,
          ...(apiKey ? { apiKey } : {}),
        });
        formApi.reset({ ...value, apiKey: '' });
        onMessage({
          tone: 'success',
          text: 'Настройки сохранены. Новые запуски используют эту версию.',
        });
      } catch (error) {
        applyServerErrors(formApi, error, {
          codes: sharedCodeTexts,
          fallback: saveFailure,
          technical: saveFailure,
        });
      }
    },
  });
  // isDirty в TanStack не сбрасывается, если значение вернули к исходному; предупреждаем только
  // при реальном отличии от сохранённых значений.
  const hasEdits = useFormSelector(
    form.store,
    (state) => !state.isDefaultValue,
  );
  useUnsavedChangesWarning(hasEdits);
  return (
    <>
      <FormRoot form={form} className="grid gap-5">
        <form.AppField name="baseURL" validators={{ onChange: addressSchema }}>
          {(field) => <field.TextField label="Адрес API" type="url" required />}
        </form.AppField>
        <form.AppField
          name="visionModel"
          validators={{ onChange: modelSchema }}
        >
          {(field) => (
            <field.TextField
              label="Модель для изображений"
              description="Читает фотографии, сканы и печати"
              required
            />
          )}
        </form.AppField>
        <form.AppField
          name="extractionModel"
          validators={{ onChange: modelSchema }}
        >
          {(field) => (
            <field.TextField
              label="Модель для извлечения сведений"
              description="Находит реквизиты и сопоставляет документы"
              required
            />
          )}
        </form.AppField>
        <form.AppField
          name="apiKey"
          validators={{
            onChange: current
              ? z.string()
              : z.string().min(1, 'Введите API-ключ'),
          }}
        >
          {(field) => (
            <field.TextField
              label="API-ключ"
              type="password"
              autoComplete="new-password"
              description={
                current
                  ? 'Оставьте пустым, чтобы сохранить текущий ключ'
                  : undefined
              }
              placeholder={current ? '••••••••••••' : undefined}
              required={!current}
            />
          )}
        </form.AppField>
        <div className="flex flex-wrap items-center gap-3">
          <form.SubmitButton size="lg">
            <Save size={17} />
            Сохранить подключение
          </form.SubmitButton>
          {current && (
            <Button
              variant="ghost"
              size="lg"
              className="text-red-300"
              disabled={save.isPending || revoke.isPending}
              onClick={() => {
                setConfirming(true);
              }}
            >
              Отозвать подключение
            </Button>
          )}
        </div>
      </FormRoot>
      <FormErrorNotice form={form} />
      <Confirm
        open={confirming}
        title="Отозвать подключение модели?"
        confirmLabel="Отозвать подключение"
        pending={revoke.isPending}
        onConfirm={revokeConnection}
        onCancel={() => {
          setConfirming(false);
        }}
      >
        Ключи подключения будут удалены. Работающие запуски анализа остановятся
        при следующем обращении к модели. Для нового анализа потребуется
        настроить подключение.
      </Confirm>
    </>
  );
}
