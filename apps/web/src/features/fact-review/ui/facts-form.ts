'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useState } from 'react';

import {
  type FieldKey,
  type FieldValue,
  type FieldValues,
} from '@anyko/contracts/catalog';
import type { WorkView } from '@anyko/contracts/works';
import {
  useAppForm,
  useFormSelector,
  useUnsavedChangesWarning,
} from '@anyko/ui/form';

import { invalidateWork, useSaveFacts } from '@/features/works';
import { ApiError, isUnauthorized } from '@/lib/api/errors';
import { useWorkspaceId } from '@/lib/api/workspace';

import {
  draftForSave,
  type FactsDraftEvent,
  type FactsDraftTransition,
  type FactsFormChange,
  hasFactsDraftEdits,
  startFactsDraft,
  transitionFactsDraft,
} from '../model/facts-draft';
import { describeFactsSaveError } from '../model/facts-messages';

function readRevision(view: WorkView) {
  return {
    revision: view.work.revision,
    cleanupPending: view.cleanupPending,
    server: view.facts.values,
  };
}

function applyFormChange(
  form: {
    reset(values: { fields: FieldValues }): void;
    setFieldValue(name: 'fields', values: FieldValues): void;
  },
  change?: FactsFormChange,
) {
  if (change?.resetTo) form.reset({ fields: change.resetTo });
  if (change?.values) form.setFieldValue('fields', change.values);
}

export function useFactsForm(view: WorkView) {
  const workspaceId = useWorkspaceId();
  const workId = view.work.id;
  const client = useQueryClient();
  const save = useSaveFacts(workspaceId, workId);
  const [sync, setSync] = useState<FactsDraftTransition>(() => ({
    draft: startFactsDraft(readRevision(view)),
  }));
  const [notice, setNotice] = useState('');
  // Серверные значения передаются как значения по умолчанию: useForm переприсваивает их на каждом рендере,
  // поэтому после сохранения и синхронизации они совпадают с ответом сервера (см. сохранение ниже).
  const form = useAppForm({
    defaultValues: { fields: view.facts.values },
    onSubmit: async ({ value }) => {
      const input = draftForSave(sync.draft, value.fields);
      if (!input) return;
      setNotice('');
      try {
        const saved = await save.mutateAsync(input);
        dispatch({ type: 'saved', snapshot: readRevision(saved) });
      } catch (failure) {
        if (isUnauthorized(failure)) return;
        setNotice(describeFactsSaveError(failure));
        // Работа изменилась после нашей ревизии: запрашиваем её заново, перенос выполнит синхронизация ниже.
        if (failure instanceof ApiError && failure.code === 'REVISION_CONFLICT')
          await invalidateWork(client, workspaceId, workId);
      }
    },
  });
  const values = useFormSelector(form.store, (state) => state.values.fields);
  const update = transitionFactsDraft(sync.draft, values, {
    type: 'revision',
    snapshot: readRevision(view),
  });
  if (update.draft !== sync.draft) setSync(update);

  // План новой редакции применяется до того, как пользователь увидит промежуточные значения.
  const formChange = sync.formChange;
  useLayoutEffect(() => {
    applyFormChange(form, formChange);
  }, [form, formChange]);

  function dispatch(event: FactsDraftEvent) {
    const next = transitionFactsDraft(
      sync.draft,
      form.state.values.fields,
      event,
    );
    if (next.draft !== sync.draft) setSync({ draft: next.draft });
    applyFormChange(form, next.formChange);
  }

  const hasEdits = hasFactsDraftEdits(sync.draft, values);
  useUnsavedChangesWarning(hasEdits);
  return {
    values,
    hasEdits,
    editConflicts: sync.draft.editConflicts,
    serverValues: sync.draft.server,
    saving: save.isPending,
    notice,
    change(changes: Partial<Record<FieldKey, FieldValue>>) {
      dispatch({ type: 'change', changes });
    },
    keepMine(key: FieldKey) {
      dispatch({ type: 'keep-edit', key });
    },
    takeServer(key: FieldKey) {
      dispatch({ type: 'take-server', key });
    },
    discard() {
      setNotice('');
      dispatch({ type: 'discard' });
    },
    save() {
      void form.handleSubmit();
    },
  };
}

export type FactsForm = ReturnType<typeof useFactsForm>;
