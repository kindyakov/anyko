import { z } from 'zod';

import type { Database } from '@anyko/database';

import { transactionHandle, type Tx } from '../../../platform/transactions';
import type {
  AcquireInput,
  AcquireOutcome,
  IdempotencyKeyRef,
  IdempotencyStore,
  StoredResponse,
} from '../application/ports';

type Connection = Pick<Database, 'idempotencyKey' | '$executeRaw'>;

export function idempotencyStoreFor(tx: Tx) {
  return createIdempotencyStore(transactionHandle<Connection>(tx));
}

export async function redactResourceResponses(
  tx: Tx,
  workspaceId: string,
  resources: { path: string[]; id: string }[],
  response: { status: number; body: z.infer<typeof storedBodySchema> },
) {
  await transactionHandle<Connection>(tx).idempotencyKey.updateMany({
    where: {
      workspaceId,
      state: 'completed',
      OR: resources.map(({ path, id }) => ({ body: { path, equals: id } })),
    },
    data: { status: response.status, body: response.body },
  });
}

// Тело хранится как JSON-объект; запись проверяет его форму и приводит к JSON так же, как ответ.
const storedBodySchema = z.record(z.string(), z.json());

const lookupKey = (ref: IdempotencyKeyRef) => ({
  workspaceId: ref.workspaceId,
  command: ref.command,
  key: ref.key,
});

// Гонки разрешаются условной вставкой и условным обновлением, а не блокировкой процесса: несколько
// реплик API используют одну таблицу. Повторов цикла хватает на удаление просроченной записи.
const maxAcquireAttempts = 3;

export function createIdempotencyStore(db: Connection): IdempotencyStore {
  return {
    async acquire(input: AcquireInput): Promise<AcquireOutcome> {
      for (let attempt = 0; attempt < maxAcquireAttempts; attempt++) {
        const inserted = await db.$executeRaw`
          INSERT INTO "IdempotencyKey"
            ("workspaceId", "command", "key", "fingerprint", "token", "state", "createdAt", "expiresAt", "lockedUntil")
          VALUES
            (${input.workspaceId}, ${input.command}, ${input.key}, ${input.fingerprint}, ${input.token}, 'in_progress', ${input.now}, ${input.expiresAt}, ${input.lockedUntil})
          ON CONFLICT ("workspaceId", "command", "key") DO NOTHING`;
        if (inserted === 1) return { kind: 'acquired' };

        const row = await db.idempotencyKey.findUnique({
          where: { workspaceId_command_key: lookupKey(input) },
        });
        // Запись исчезла между вставкой и чтением: попытаемся захватить снова.
        if (!row) continue;
        // Просроченная запись считается отсутствующей и уступает место новой команде.
        if (row.expiresAt <= input.now) {
          await db.idempotencyKey.deleteMany({
            where: { ...lookupKey(input), token: row.token },
          });
          continue;
        }
        if (row.fingerprint !== input.fingerprint) return { kind: 'conflict' };
        if (row.state === 'completed') {
          if (row.status === null)
            throw new Error('IDEMPOTENCY_RESPONSE_MISSING');
          return {
            kind: 'replay',
            response: {
              status: row.status,
              body: storedBodySchema.parse(row.body),
            },
          };
        }
        if (row.state !== 'in_progress')
          throw new Error('IDEMPOTENCY_STATE_UNKNOWN');
        if (row.lockedUntil > input.now) return { kind: 'in_progress' };
        // Захват зависел от упавшего процесса: перехватываем, если строка не сменилась.
        const taken = await db.idempotencyKey.updateMany({
          where: {
            ...lookupKey(input),
            token: row.token,
            state: 'in_progress',
          },
          data: {
            token: input.token,
            expiresAt: input.expiresAt,
            lockedUntil: input.lockedUntil,
          },
        });
        if (taken.count === 1) return { kind: 'acquired' };
      }
      throw new Error('IDEMPOTENCY_ACQUIRE_UNSETTLED');
    },

    async complete(ref, token, response: StoredResponse, now) {
      // Тот же путь приведения к JSON, что у ответа: повтор отдаёт побайтно то же содержимое.
      const body = storedBodySchema.parse(
        JSON.parse(JSON.stringify(response.body)),
      );
      const saved = await db.idempotencyKey.updateMany({
        where: { ...lookupKey(ref), token, state: 'in_progress' },
        data: {
          state: 'completed',
          status: response.status,
          body,
          lockedUntil: now,
        },
      });
      return saved.count === 1;
    },

    async release(ref, token) {
      await db.idempotencyKey.deleteMany({
        where: { ...lookupKey(ref), token, state: 'in_progress' },
      });
    },
  };
}
