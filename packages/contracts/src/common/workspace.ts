import { z } from 'zod';

// Рабочая область в адресе: `/workspaces/:workspaceId/...` (ADR 0008, ADR 0009). Формат проверяет
// схема; принадлежность пользователю проверяет API до разбора остального входа. У локальной области
// id `local`, поэтому не каждый идентификатор — UUID.
export const workspaceIdSchema = z.string().regex(/^[\w-]{1,128}$/);

export const workspaceParams = z.object({ workspaceId: workspaceIdSchema });
