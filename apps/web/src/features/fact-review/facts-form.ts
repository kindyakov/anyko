'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useState } from 'react';

import {
  type FieldKey,
  fieldKeySchema,
  type FieldValue,
  type FieldValues,
} from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';

import {
  useAppForm,
  useFormSelector,
  useUnsavedChangesWarning,
} from '@/components/ui/form';
import { invalidateWork, useSaveFacts } from '@/features/works';
import { ApiError, isUnauthorized } from '@/lib/api/errors';
import { useWorkspaceId } from '@/lib/api/workspace';

import { describeFactsSaveError } from './model/facts-messages';
import { sameFieldValue, sameFieldValues } from './model/field-value';
import { rebaseFacts } from './model/rebase';

type Sync = {
  // Ревизия работы и режим очистки, с которыми форма синхронизирована.
  revision: number;
  cleanupPending: boolean;
  // Серверные значения, от которых начаты правки: основа для переноса и для «Отменить».
  server: FieldValues;
  // Поля, которые изменили и пользователь, и сервер по-разному: решение пользователя ещё не принято.
  conflicts: readonly FieldKey[];
  // Значения для формы после переноса. Новый объект появляется только при синхронизации с сервером.
  applied?: { server: FieldValues; values: FieldValues };
};

// Форма сведений работы. Правки живут в памяти TanStack Form и нигде не сохраняются. Когда приходит новая
// ревизия работы, правки переносятся (rebaseFacts): поле, которое пользователь не менял, принимает серверное
// значение, а конфликтное остаётся с правкой пользователя до явного решения.
export function useFactsForm(view: WorkView) {
  const workspaceId = useWorkspaceId();
  const workId = view.work.id;
  const client = useQueryClient();
  const save = useSaveFacts(workspaceId, workId);
  const [sync, setSync] = useState<Sync>(() => ({
    revision: view.work.revision,
    cleanupPending: view.cleanupPending,
    server: view.facts.values,
    conflicts: [],
  }));
  const [notice, setNotice] = useState('');
  // Серверные значения передаются как значения по умолчанию: useForm переприсваивает их на каждом рендере,
  // поэтому после сохранения и синхронизации они совпадают с ответом сервера (см. сохранение ниже).
  const form = useAppForm({
    defaultValues: view.facts.values,
    onSubmit: async ({ value, formApi }) => {
      // Конфликтные поля сохранять нельзя: кнопка неактивна, и проверка повторяется здесь.
      if (sync.conflicts.length > 0) return;
      setNotice('');
      try {
        const saved = await save.mutateAsync({
          revision: sync.revision,
          values: value,
        });
        setSync({
          revision: saved.work.revision,
          cleanupPending: saved.cleanupPending,
          server: saved.facts.values,
          conflicts: [],
        });
        formApi.reset(saved.facts.values);
      } catch (failure) {
        if (isUnauthorized(failure)) return;
        setNotice(describeFactsSaveError(failure));
        // Работа изменилась после нашей ревизии: запрашиваем её заново, перенос выполнит синхронизация ниже.
        if (failure instanceof ApiError && failure.code === 'REVISION_CONFLICT')
          await invalidateWork(client, workspaceId, workId);
      }
    },
  });
  const values = useFormSelector(form.store, (state) => state.values);
  // Новая ревизия или начало очистки: переносим правки до отрисовки. Во время очистки правок не принимается.
  if (
    view.work.revision !== sync.revision ||
    view.cleanupPending !== sync.cleanupPending
  ) {
    const mine = view.cleanupPending ? view.facts.values : values;
    const result = rebaseFacts({
      base: sync.server,
      mine,
      theirs: view.facts.values,
    });
    // Нерешённый конфликт остаётся конфликтом, пока правка пользователя отличается от серверного значения:
    // база переноса уже серверная, и без этого следующая ревизия сочла бы поле «не изменённым на сервере».
    const unresolved = sync.conflicts.filter(
      (key) => !sameFieldValue(mine[key], view.facts.values[key]),
    );
    setSync({
      revision: view.work.revision,
      cleanupPending: view.cleanupPending,
      server: view.facts.values,
      conflicts: fieldKeySchema.options.filter(
        (key) =>
          unresolved.includes(key) ||
          result.conflicts.some((conflict) => conflict.key === key),
      ),
      applied: {
        server: view.facts.values,
        values: { ...view.facts.values, ...result.values },
      },
    });
  }
  const applied = sync.applied;
  // Layout-эффект: форма получает результат переноса до отрисовки, без промежуточного кадра.
  useLayoutEffect(() => {
    if (!applied) return;
    form.reset(applied.server);
    for (const key of fieldKeySchema.options) {
      if (!sameFieldValue(applied.values[key], applied.server[key]))
        form.setFieldValue(key, applied.values[key]);
    }
  }, [form, applied]);
  const hasEdits =
    !view.cleanupPending && !sameFieldValues(values, sync.server);
  useUnsavedChangesWarning(hasEdits);
  return {
    values,
    hasEdits,
    conflicts: sync.conflicts,
    serverValues: sync.server,
    saving: save.isPending,
    notice,
    change(changes: Partial<Record<FieldKey, FieldValue>>) {
      for (const key of fieldKeySchema.options) {
        const next = changes[key];
        if (next !== undefined) form.setFieldValue(key, next);
      }
    },
    // Пользователь оставил свою правку: поле больше не конфликтует, значение не меняется.
    keepMine(key: FieldKey) {
      setSync((previous) => ({
        ...previous,
        conflicts: previous.conflicts.filter((item) => item !== key),
      }));
    },
    // Пользователь выбрал серверное значение: поле возвращается к нему и перестаёт конфликтовать.
    takeServer(key: FieldKey) {
      form.setFieldValue(key, sync.server[key]);
      setSync((previous) => ({
        ...previous,
        conflicts: previous.conflicts.filter((item) => item !== key),
      }));
    },
    discard() {
      setNotice('');
      form.reset(sync.server);
      setSync((previous) => ({ ...previous, conflicts: [] }));
    },
    save() {
      void form.handleSubmit();
    },
  };
}

export type FactsForm = ReturnType<typeof useFactsForm>;
