import { Elysia } from 'elysia';
import { z } from 'zod';
import {
  createWorkSchema,
  editWorkSchema,
  revisionSchema,
  llmSettingsInputSchema,
} from '@anyko/contracts';
import { WorkError, type WorkApi } from '@anyko/backend/works';
import type { LlmSettingsStore } from '@anyko/backend/processing';
import type { DocumentHttpOptions } from './documents';
import { workEventStream } from './work-events';

export interface WorkHttpOptions extends DocumentHttpOptions {
  works: WorkApi;
  settings: Pick<LlmSettingsStore, 'current' | 'save'>;
  saveSettings(
    workspaceId: string,
    input: z.infer<typeof llmSettingsInputSchema>,
  ): Promise<void>;
}
const id = (value: string) => {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new WorkError('INVALID_WORK_INPUT');
  return parsed.data;
};
async function body<T>(request: Request, schema: z.ZodType<T>) {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new WorkError('INVALID_WORK_INPUT');
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new WorkError('INVALID_WORK_INPUT');
  return parsed.data;
}
export function workRoutes(options: WorkHttpOptions) {
  return new Elysia().group('/api', (app) =>
    app
      .resolve(async ({ request, set }) => {
        set.headers['cache-control'] = 'no-store';
        return { session: await options.access.session(request.headers) };
      })
      .onBeforeHandle(({ session, request, set }) => {
        const code = !session
          ? 'UNAUTHORIZED'
          : request.method !== 'GET' &&
              request.headers.get('origin') !== options.origin
            ? 'INVALID_ORIGIN'
            : null;
        if (code) {
          set.status = code === 'UNAUTHORIZED' ? 401 : 403;
          return {
            error: { code, requestId: set.headers['x-request-id'] ?? '' },
          };
        }
      })
      .get('/document-packages', () => ({ packages: options.works.packages() }))
      .get('/works', async ({ session, query }) => {
        if (!session) throw new WorkError('FORBIDDEN');
        return options.works.list(
          session.workspace.id,
          query.after ? id(query.after) : undefined,
        );
      })
      .post(
        '/works',
        async ({ session, request, set }) => {
          if (!session) throw new WorkError('FORBIDDEN');
          const value = await body(request, createWorkSchema);
          set.status = 201;
          return options.works.create({
            ...value,
            workspaceId: session.workspace.id,
            actorId: session.user.id,
          });
        },
        { parse: 'none' },
      )
      .get('/works/:id', ({ session, params }) => {
        if (!session) throw new WorkError('FORBIDDEN');
        return options.works.get(session.workspace.id, id(params.id));
      })
      .get('/works/:id/events', async ({ session, params, request }) => {
        if (!session) throw new WorkError('FORBIDDEN');
        const after =
          request.headers.get('last-event-id') ??
          new URL(request.url).searchParams.get('after') ??
          '0';
        await options.works.events(session.workspace.id, id(params.id), after);
        return workEventStream({
          request,
          workId: params.id,
          workspaceId: session.workspace.id,
          userId: session.user.id,
          after,
          works: options.works,
          access: options.access,
        });
      })
      .post(
        '/works/:id/documents',
        async ({ session, params, request, set }) => {
          if (!session) throw new WorkError('FORBIDDEN');
          let form: FormData;
          try {
            form = await request.formData();
          } catch {
            throw new WorkError('INVALID_WORK_INPUT');
          }
          const file = form.get('file');
          if (!(file instanceof File) || file.size > 20 * 1024 * 1024)
            throw new WorkError('INVALID_WORK_INPUT');
          const document = await options.works.upload({
            workspaceId: session.workspace.id,
            workId: id(params.id),
            actorId: session.user.id,
            requestKey: id(request.headers.get('idempotency-key') ?? ''),
            filename: file.name,
            bytes: new Uint8Array(await file.arrayBuffer()),
            correlationId: set.headers['x-request-id'] ?? crypto.randomUUID(),
          });
          set.status = 202;
          return { document };
        },
        { parse: 'none' },
      )
      .post('/works/:id/analyze', async ({ session, params, set }) => {
        if (!session) throw new WorkError('FORBIDDEN');
        await options.works.analyze({
          workspaceId: session.workspace.id,
          workId: id(params.id),
          actorId: session.user.id,
          correlationId: set.headers['x-request-id'] ?? crypto.randomUUID(),
        });
        set.status = 202;
        return { status: 'queued' };
      })
      .delete(
        '/works/:id/documents/:documentId',
        async ({ session, params, set }) => {
          if (!session) throw new WorkError('FORBIDDEN');
          await options.works.removeDocument({
            workspaceId: session.workspace.id,
            workId: id(params.id),
            documentId: id(params.documentId),
          });
          set.status = 202;
          return { status: 'deleting' };
        },
      )
      .post(
        '/works/:id/fields',
        async ({ session, params, request }) => {
          if (!session) throw new WorkError('FORBIDDEN');
          return options.works.edit({
            ...(await body(request, editWorkSchema)),
            workspaceId: session.workspace.id,
            workId: id(params.id),
          });
        },
        { parse: 'none' },
      )
      .post(
        '/works/:id/confirm',
        async ({ session, params, request }) => {
          if (!session) throw new WorkError('FORBIDDEN');
          return options.works.confirm({
            ...(await body(request, revisionSchema)),
            workspaceId: session.workspace.id,
            workId: id(params.id),
          });
        },
        { parse: 'none' },
      )
      .post(
        '/works/:id/generate',
        async ({ session, params, request, set }) => {
          if (!session) throw new WorkError('FORBIDDEN');
          await options.works.generate({
            ...(await body(request, revisionSchema)),
            workspaceId: session.workspace.id,
            workId: id(params.id),
            actorId: session.user.id,
            correlationId: set.headers['x-request-id'] ?? crypto.randomUUID(),
          });
          set.status = 202;
          return { status: 'queued' };
        },
        { parse: 'none' },
      )
      .get(
        '/works/:id/generations/:generationId/files/:fileId',
        async ({ session, params }) => {
          if (!session) throw new WorkError('FORBIDDEN');
          const result = await options.works.download(
            session.workspace.id,
            id(params.id),
            id(params.generationId),
            id(params.fileId),
          );
          return new Response(Uint8Array.from(result.bytes), {
            headers: {
              'content-type':
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'content-disposition': `attachment; filename="${result.filename}"`,
              'cache-control': 'no-store',
              'x-content-type-options': 'nosniff',
            },
          });
        },
      )
      .get('/settings/llm', async ({ session }) => {
        if (!session) throw new WorkError('FORBIDDEN');
        const canManage = await options.access.canManage(
          session.user.id,
          session.workspace.id,
        );
        const settings = await options.settings.current(session.workspace.id);
        return {
          settings: settings ? { ...settings, configured: true } : null,
          canManage,
        };
      })
      .post(
        '/settings/llm',
        async ({ session, request }) => {
          if (
            !session ||
            !(await options.access.canManage(
              session.user.id,
              session.workspace.id,
            ))
          )
            throw new WorkError('FORBIDDEN');
          await options.saveSettings(
            session.workspace.id,
            await body(request, llmSettingsInputSchema),
          );
          return { status: 'saved' };
        },
        { parse: 'none' },
      ),
  );
}
