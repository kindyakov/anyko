import { expect, test } from 'bun:test';

import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useWorkView } from '@/features/works';
import { createQueryClient } from '@/lib/api/query-client';

import { installEventSource, json, serveApi } from '../../../../test/api';
import {
  workAddress,
  workId,
  workspaceId,
  workView,
} from '../../../../test/fixtures';

import { useRevokeLlmSettings, useSaveLlmSettings } from './mutations';

test.each(['save', 'revoke'] as const)(
  '%s refreshes the analysis availability of a loaded work',
  async (action) => {
    installEventSource();
    let configured = action === 'revoke';
    const initialAvailability = configured;
    serveApi(({ url, method }) => {
      if (url === workAddress && method === 'GET') {
        return json(200, {
          ...workView,
          availability: {
            ...workView.availability,
            analyze: configured
              ? { available: true }
              : { available: false, reason: 'LLM_NOT_CONFIGURED' },
          },
        });
      }
      if (
        url === `/api/v1/workspaces/${workspaceId}/connections/llm` &&
        method === (action === 'save' ? 'PATCH' : 'DELETE')
      ) {
        configured = action === 'save';
        return json(200, { status: configured ? 'saved' : 'revoked' });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    const client = createQueryClient();
    const { result } = renderHook(
      () => ({
        view: useWorkView({ workspaceId, workId }).view,
        save: useSaveLlmSettings(workspaceId),
        revoke: useRevokeLlmSettings(workspaceId),
      }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await waitFor(() => {
      expect(result.current.view?.availability.analyze.available).toBe(
        initialAvailability,
      );
    });
    if (action === 'save') {
      await result.current.save.mutateAsync({
        baseURL: 'https://models.example.test/v1',
        visionModel: 'vision-model',
        extractionModel: 'extraction-model',
      });
    } else {
      await result.current.revoke.mutateAsync();
    }
    await waitFor(() => {
      expect(result.current.view?.availability.analyze.available).toBe(
        !initialAvailability,
      );
    });
  },
);
