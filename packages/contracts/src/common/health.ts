import { z } from 'zod';

// Health-маршруты живут вне /api/v1 и не описываются endpoint-описанием.
export const healthResponseSchema = z.object({ status: z.literal('ok') });
