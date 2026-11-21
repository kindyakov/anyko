'use client';
import { Switch } from '@base-ui/react/switch';
import { Save } from 'lucide-react';
import { useId, useState } from 'react';
import { z } from 'zod';

import { llmSettingsResponseSchema } from '@anyko/contracts/connections';
import { Button, Confirm } from '@anyko/ui';
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
import {
  describeApiError,
  isUnauthorized,
  sharedCodeTexts,
} from '@/lib/api/errors';
import { applyServerErrors } from '@/lib/api/form-errors';
import { useWorkspaceId } from '@/lib/api/workspace';

export type ConnectionMessage = { tone: 'success' | 'danger'; text: string };
export type LlmSettings = NonNullable<
  z.infer<typeof llmSettingsResponseSchema>['settings']
>;

const defaultBaseURL = 'https://routerai.ru/api/v1';
const defaultModel = '~deepseek/deepseek-v4-flash-latest';
const visionReasoningLabel =
  'Отключать рассуждения при распознавании изображений';
const extractionReasoningLabel =
  'Включать высокий уровень рассуждений при извлечении сведений';
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

function ReasoningSwitch({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const descriptionId = useId();
  return (
    <div className="grid gap-1.5">
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-describedby={descriptionId}
        className="focus-visible:outline-brand-hot group flex w-fit items-center gap-2.5 rounded-md text-left text-[13px] font-medium text-zinc-200 focus-visible:outline-2"
      >
        <span
          aria-hidden
          className="group-data-checked:bg-brand flex h-4 w-7 shrink-0 items-center rounded-full bg-white/[0.16] p-0.5 transition-colors"
        >
          <Switch.Thumb className="size-3 rounded-full bg-white shadow transition-transform data-checked:translate-x-3" />
        </span>
        {label}
      </Switch.Root>
      <p id={descriptionId} className="text-muted text-xs leading-5">
        {description}
      </p>
    </div>
  );
}

// Форма создаётся заново при смене версии настроек на сервере (key по revision): значения берутся
// из сохранённой версии, а после успешного сохранения сбрасываются к ней через reset.
export function ConnectionForm({
  current,
  onMessage,
}: {
  current: LlmSettings | null;
  onMessage: (message: ConnectionMessage | undefined) => void;
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
      visionDisableReasoning: current?.visionDisableReasoning ?? true,
      extractionEnableReasoning: current?.extractionEnableReasoning ?? true,
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
        <form.AppField
          name="baseURL"
          validators={{ onChange: addressSchema }}
          listeners={{
            onChange: ({ value }) => {
              const saved = value === current?.baseURL ? current : undefined;
              form.setFieldValue(
                'visionDisableReasoning',
                form.getFieldValue('visionModel') === saved?.visionModel
                  ? saved.visionDisableReasoning
                  : true,
              );
              form.setFieldValue(
                'extractionEnableReasoning',
                form.getFieldValue('extractionModel') === saved?.extractionModel
                  ? saved.extractionEnableReasoning
                  : true,
              );
            },
          }}
        >
          {(field) => <field.TextField label="Адрес API" type="url" required />}
        </form.AppField>
        <form.AppField
          name="visionModel"
          validators={{ onChange: modelSchema }}
          listeners={{
            onChange: ({ value }) => {
              const saved =
                form.getFieldValue('baseURL') === current?.baseURL &&
                value === current.visionModel;
              form.setFieldValue(
                'visionDisableReasoning',
                saved ? current.visionDisableReasoning : true,
              );
            },
          }}
        >
          {(field) => (
            <field.TextField
              label="Модель для изображений"
              description="Читает фотографии, сканы и печати"
              required
            />
          )}
        </form.AppField>
        <form.AppField name="visionDisableReasoning">
          {(field) => (
            <ReasoningSwitch
              label={visionReasoningLabel}
              description="Для новой модели включено. Если модель не поддерживает отключение рассуждений, можно оставить режим провайдера."
              checked={field.state.value}
              onCheckedChange={field.handleChange}
            />
          )}
        </form.AppField>
        <form.AppField
          name="extractionModel"
          validators={{ onChange: modelSchema }}
          listeners={{
            onChange: ({ value }) => {
              const saved =
                form.getFieldValue('baseURL') === current?.baseURL &&
                value === current.extractionModel;
              form.setFieldValue(
                'extractionEnableReasoning',
                saved ? current.extractionEnableReasoning : true,
              );
            },
          }}
        >
          {(field) => (
            <field.TextField
              label="Модель для извлечения сведений"
              description="Находит реквизиты и сопоставляет документы"
              required
            />
          )}
        </form.AppField>
        <form.AppField name="extractionEnableReasoning">
          {(field) => (
            <ReasoningSwitch
              label={extractionReasoningLabel}
              description="При выключенном переключателе запрос использует средний уровень рассуждений."
              checked={field.state.value}
              onCheckedChange={field.handleChange}
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
