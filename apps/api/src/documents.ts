import { Elysia } from 'elysia';
import { createDocumentService } from '@anyko/backend/documents';
import { createAccess } from '@anyko/backend/access';
import { z } from 'zod';

export interface DocumentHttpOptions {
  documents: ReturnType<typeof createDocumentService>;
  access: ReturnType<typeof createAccess>;
  origin: string;
}

export function documentRoutes(options: DocumentHttpOptions) {
  return new Elysia()
    .all('/api/auth/*', ({ request }) => options.access.handle(request), {
      parse: 'none',
    })
    .get('/api/session', async ({ request, set }) => {
      set.headers['cache-control'] = 'no-store';
      const session = await options.access.session(request.headers);
      if (!session) {
        set.status = 401;
        return {
          error: {
            code: 'UNAUTHORIZED',
            requestId: set.headers['x-request-id'] ?? '',
          },
        };
      }
      return session;
    })
    .group('/api/documents', (app) =>
      app
        .resolve(async ({ request, set }) => {
          set.headers['cache-control'] = 'no-store';
          const session = await options.access.session(request.headers);
          return { session };
        })
        .onBeforeHandle(({ session, request, set }) => {
          if (!session) {
            set.status = 401;
            return {
              error: {
                code: 'UNAUTHORIZED',
                requestId: set.headers['x-request-id'] ?? '',
              },
            };
          }
          if (
            request.method !== 'GET' &&
            request.method !== 'HEAD' &&
            request.headers.get('origin') !== options.origin
          ) {
            set.status = 403;
            return {
              error: {
                code: 'INVALID_ORIGIN',
                requestId: set.headers['x-request-id'] ?? '',
              },
            };
          }
        })
        .get('', async ({ session }) => {
          if (!session) throw new Error('UNAUTHORIZED');
          return {
            documents: await options.documents.list({
              workspaceId: session.workspace.id,
            }),
          };
        })
        .post(
          '',
          async ({ request, session, set }) => {
            if (!session) throw new Error('UNAUTHORIZED');
            const key = z
              .uuid()
              .safeParse(request.headers.get('idempotency-key'));
            if (!key.success) {
              set.status = 400;
              return {
                error: {
                  code: 'INVALID_IDEMPOTENCY_KEY',
                  requestId: set.headers['x-request-id'] ?? '',
                },
              };
            }
            let form: FormData;
            try {
              form = await request.formData();
            } catch {
              set.status = 400;
              return {
                error: {
                  code: 'INVALID_PDF',
                  requestId: set.headers['x-request-id'] ?? '',
                },
              };
            }
            const file = form.get('file');
            if (!(file instanceof File) || file.size > 20 * 1024 * 1024) {
              set.status = 400;
              return {
                error: {
                  code: 'INVALID_PDF',
                  requestId: set.headers['x-request-id'] ?? '',
                },
              };
            }
            const document = await options.documents.upload({
              workspaceId: session.workspace.id,
              actorId: session.user.id,
              filename: file.name,
              requestKey: key.data,
              bytes: new Uint8Array(await file.arrayBuffer()),
              correlationId: set.headers['x-request-id'] ?? crypto.randomUUID(),
            });
            set.status = 202;
            return { document };
          },
          { parse: 'none' },
        )
        .get('/:id', async ({ params, session }) => {
          if (!session) throw new Error('UNAUTHORIZED');
          return {
            document: await options.documents.get({
              workspaceId: session.workspace.id,
              documentId: params.id,
            }),
          };
        })
        .get('/:id/result', async ({ params, session }) => {
          if (!session) throw new Error('UNAUTHORIZED');
          return options.documents.result({
            workspaceId: session.workspace.id,
            documentId: params.id,
          });
        })
        .post('/:id/retry', async ({ params, session, set }) => {
          if (!session) throw new Error('UNAUTHORIZED');
          const document = await options.documents.retry({
            workspaceId: session.workspace.id,
            documentId: params.id,
            actorId: session.user.id,
            correlationId: set.headers['x-request-id'] ?? crypto.randomUUID(),
          });
          set.status = 202;
          return { document };
        }),
    );
}
