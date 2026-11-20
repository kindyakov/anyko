import { Field } from '@base-ui/react/field';
import { ArrowUp } from 'lucide-react';
import { useRef } from 'react';

import { Button, Notice } from '@anyko/ui';
import { InputGroup, InputGroupTextarea } from '@anyko/ui/chat';
import { FormRoot, useAppForm, useFormSelector } from '@anyko/ui/form';

import { describeApiError, sharedCodeTexts } from '@/lib/api/errors';
import { createIdempotencyKey } from '@/lib/api/idempotency';

import { useSendChatMessage } from '../api/chat';

export function ChatComposer({
  workspaceId,
  workId,
  canSend,
  unavailableText,
}: {
  workspaceId: string;
  workId: string;
  canSend: boolean;
  unavailableText: string | undefined;
}) {
  const send = useSendChatMessage(workspaceId, workId);
  const attempt = useRef<{
    text: string;
    key: ReturnType<typeof createIdempotencyKey>;
  }>(null);
  const form = useAppForm({
    defaultValues: { message: '' },
    async onSubmit({ value, formApi }) {
      const userText = value.message.trim();
      if (!canSend || send.isPending || !userText) return;
      if (attempt.current?.text !== userText) {
        attempt.current = { text: userText, key: createIdempotencyKey() };
      }
      try {
        await send.mutateAsync({ userText, key: attempt.current.key });
      } catch {
        return;
      }
      attempt.current = null;
      formApi.reset();
    },
  });
  const submitting = useFormSelector(form.store, (state) => state.isSubmitting);
  const ready = useFormSelector(
    form.store,
    (state) => state.values.message.trim() !== '',
  );
  const error = send.error;
  return (
    <footer className="bg-canvas/90 shrink-0 border-t border-white/8 px-4 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-7">
      {error && (
        <div className="mb-3">
          <Notice tone="danger" role="alert">
            {describeApiError(error, {
              codes: {
                FORBIDDEN: sharedCodeTexts.FORBIDDEN,
                WORK_BUSY: 'Агент ещё выполняет текущий запуск.',
                LLM_NOT_CONFIGURED: 'Подключите модель в настройках.',
              },
            })}
          </Notice>
        </div>
      )}
      <FormRoot form={form}>
        <InputGroup>
          <form.Field name="message">
            {(field) => (
              <Field.Root className="min-w-0 flex-1">
                <Field.Label className="sr-only">Сообщение агенту</Field.Label>
                <Field.Control
                  render={<InputGroupTextarea rows={1} />}
                  value={field.state.value}
                  readOnly={submitting}
                  placeholder="Напишите агенту…"
                  maxLength={6000}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key !== 'Enter' ||
                      event.shiftKey ||
                      event.nativeEvent.isComposing
                    )
                      return;
                    event.preventDefault();
                    if (canSend && ready && !submitting)
                      event.currentTarget.closest('form')?.requestSubmit();
                  }}
                />
              </Field.Root>
            )}
          </form.Field>
          <Button
            type="submit"
            size="icon"
            className="rounded-full"
            loading={submitting}
            disabled={!canSend || !ready}
            aria-label="Отправить"
            title="Отправить"
          >
            <ArrowUp size={20} aria-hidden />
          </Button>
        </InputGroup>
      </FormRoot>
      <p role="status" className="text-muted mt-2 min-h-4 px-1 text-xs">
        {submitting
          ? 'Отправляем сообщение…'
          : (unavailableText ?? (
              <span className="hidden sm:inline">
                Enter — отправить · Shift + Enter — новая строка
              </span>
            ))}
      </p>
    </footer>
  );
}
