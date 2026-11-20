import type { Elysia } from 'elysia';

import type { ConnectionSettingsApi } from '@anyko/backend/connections';
import {
  getLlmSettings,
  revokeLlmSettings,
  saveLlmSettings,
} from '@anyko/contracts/connections';

import type { Route } from '../../route';

export interface ConnectionHttpOptions {
  settings: ConnectionSettingsApi;
}

// Право connections.read/connections.manage проверяет сценарий. Маршрут не знает ролей.
export function connectionRoutes(
  route: Route,
  app: Elysia,
  options: ConnectionHttpOptions,
) {
  route(app, getLlmSettings, async ({ scope }) => {
    const { settings, canManage } = await options.settings.current(scope);
    return {
      settings: settings ? { ...settings, configured: true } : null,
      canManage,
    };
  });
  route(app, saveLlmSettings, async ({ scope, body }) => {
    await options.settings.save(scope, body);
    return { status: 'saved' as const };
  });
  route(app, revokeLlmSettings, async ({ scope }) => {
    await options.settings.revoke(scope);
    return { status: 'revoked' as const };
  });
}
