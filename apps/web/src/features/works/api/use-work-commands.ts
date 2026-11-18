'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import type { WorkView } from '@anyko/contracts/works';

import { ApiError, isUnauthorized } from '@/lib/api/errors';

import {
  describeWorkCommandError,
  workCommandReasons,
} from '../model/command-errors';

import { useGenerateWork } from './generation-command';
import { invalidateWork, useAnalyzeWork, useConfirmWork } from './mutations';
import {
  type Upload,
  uploadWorkFiles,
  useDeleteWorkDocument,
  useRetryWorkDocument,
  useUploadWorkDocument,
} from './source-commands';

export function useWorkCommands(
  workspaceId: string,
  view: WorkView,
  savingFacts: boolean,
) {
  const client = useQueryClient();
  const { id: workId, revision } = view.work;
  const [error, setError] = useState('');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const clearUploads = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(
    () => () => {
      clearTimeout(clearUploads.current);
    },
    [],
  );
  const analysis = useAnalyzeWork(workspaceId, workId);
  const confirmation = useConfirmWork(workspaceId, workId);
  const generation = useGenerateWork(workspaceId, workId);
  const uploadDocument = useUploadWorkDocument(workspaceId, workId);
  const deletion = useDeleteWorkDocument(workspaceId, workId);
  const retry = useRetryWorkDocument(workspaceId, workId);

  const uploading = uploads.some((item) => item.state === 'uploading');
  const pending =
    analysis.isPending ||
    confirmation.isPending ||
    savingFacts ||
    generation.isPending ||
    retry.isPending ||
    deletion.isPending;
  const busy = pending || uploading;
  const availability = view.availability;
  const disabled = {
    analyze: busy || !availability.analyze.available,
    generate: busy || !availability.generate.available,
    confirm: busy || !availability.confirm.available,
    upload: busy || !availability.upload.available,
    remove: busy || !availability.remove.available,
  };
  const reasons = Object.values(availability).flatMap((item) =>
    item.available ? [] : [workCommandReasons[item.reason]],
  );

  function fail(failure: unknown) {
    if (isUnauthorized(failure)) return;
    setError(describeWorkCommandError(failure));
    if (
      failure instanceof ApiError &&
      Object.hasOwn(workCommandReasons, failure.code)
    )
      void invalidateWork(client, workspaceId, workId);
  }

  return {
    error,
    reasons: [...new Set(reasons)].filter((reason) => reason !== error),
    disabled,
    pending,
    uploads,
    editingBlocked: busy || view.cleanupPending,
    removing: deletion.isPending,
    retryingId: retry.isPending ? retry.variables : undefined,
    analyze: (onSuccess: () => void) => {
      if (disabled.analyze) return;
      setError('');
      analysis.mutate(undefined, { onSuccess, onError: fail });
    },
    generate: (onSuccess: () => void) => {
      if (disabled.generate) return;
      setError('');
      generation.mutate(revision, { onSuccess, onError: fail });
    },
    confirm: () => {
      if (disabled.confirm) return;
      setError('');
      confirmation.mutate({ revision }, { onError: fail });
    },
    upload: async (files: File[]) => {
      if (disabled.upload) return 0;
      clearTimeout(clearUploads.current);
      setError('');
      const accepted = await uploadWorkFiles(
        files,
        (file, idempotencyKey) =>
          uploadDocument.mutateAsync({ file, idempotencyKey }),
        setUploads,
      );
      clearUploads.current = setTimeout(() => {
        setUploads((items) => items.filter((item) => item.state !== 'done'));
      }, 2500);
      return accepted;
    },
    remove: async (documentId: string) => {
      if (disabled.remove) return;
      setError('');
      try {
        await deletion.mutateAsync(documentId);
      } catch (failure) {
        fail(failure);
      }
    },
    retry: (documentId: string) => {
      setError('');
      retry.mutate(documentId, { onError: fail });
    },
  };
}
