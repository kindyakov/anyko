import type { Elysia } from 'elysia';
import type { z } from 'zod';

import type { createAccess } from '@anyko/backend/access';
import type { LlmSettingsStore } from '@anyko/backend/processing';
import { WorkError } from '@anyko/backend/works';
import {
  getLlmSettings,
  llmSettingsInputSchema,
  saveLlmSettings,
} from '@anyko/contracts/connections';

import type { Route } from '../../route';

export interface ConnectionHttpOptions {
  access: ReturnType<typeof createAccess>;
  settings: Pick<LlmSettingsStore, 'current' | 'save'>;
  saveSettings(
    workspaceId: string,
    input: z.infer<typeof llmSettingsInputSchema>,
  ): Promise<void>;
}

export function connectionRoutes(
  route: Route,
  app: Elysia,
  options: ConnectionHttpOptions,
) {
  route(app, getLlmSettings, async ({ session }) => {
    const canManage = await options.access.canManage(
      session.user.id,
      session.workspace.id,
    );
    const settings = await options.settings.current(session.workspace.id);
    return {
      settings: settings ? { ...settings, configured: true } : null,
      canManage,
    };
  });
  route(
    app,
    saveLlmSettings,
    async ({ session, body }) => {
      await options.saveSettings(session.workspace.id, body);
      return { status: 'saved' as const };
    },
    {
      // Право проверяется до разбора тела, как и раньше: без права тело не читается.
      guard: async ({ session }) => {
        if (
          !(await options.access.canManage(
            session.user.id,
            session.workspace.id,
          ))
        )
          throw new WorkError('FORBIDDEN');
      },
    },
  );
}
