'use client';
import { useEffect, useRef, useState } from 'react';

import type { DocumentSummary } from '@anyko/contracts/documents';

import { fileChecksum, findUploadMatches } from '../../api/upload-matches';

import { UploadMatchDialog } from './upload-match-dialog';

type Choice =
  { kind: 'separate' } | { kind: 'reuse'; document: DocumentSummary } | null;

export function useUploadMatchChoice(workspaceId: string) {
  const [prompt, setPrompt] = useState<{
    filename: string;
    checksum: string;
    first: Awaited<ReturnType<typeof findUploadMatches>>;
    attached: ReadonlySet<string> | undefined;
  }>();
  const resolveChoice = useRef<(choice: Choice) => void>(undefined);
  const lifetime = useRef<AbortController>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => {
      controller.abort();
      resolveChoice.current?.(null);
      resolveChoice.current = undefined;
    };
  }, []);

  async function decide(
    file: File,
    attached?: ReadonlySet<string>,
  ): Promise<Choice> {
    const signal = lifetime.current?.signal;
    if (!signal) return null;
    try {
      signal.throwIfAborted();
      const checksum = await fileChecksum(file);
      signal.throwIfAborted();
      const first = await findUploadMatches(workspaceId, checksum, signal);
      signal.throwIfAborted();
      if (!first.items.length) return { kind: 'separate' };
      return await new Promise((resolve) => {
        resolveChoice.current = resolve;
        setPrompt({ filename: file.name, checksum, first, attached });
      });
    } catch (error) {
      if (signal.aborted) return null;
      throw error;
    }
  }

  function finish(choice: Choice) {
    const resolve = resolveChoice.current;
    resolveChoice.current = undefined;
    setPrompt(undefined);
    resolve?.(choice);
  }

  const dialog = prompt && (
    <UploadMatchDialog
      workspaceId={workspaceId}
      {...prompt}
      onUse={(document) => {
        finish({ kind: 'reuse', document });
      }}
      onSeparate={() => {
        finish({ kind: 'separate' });
      }}
      onClose={() => {
        finish(null);
      }}
    />
  );
  return { decide, dialog };
}
