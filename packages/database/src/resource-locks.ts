import { Pool } from 'pg';

/** Session locks serialize external I/O without holding a SQL transaction open. */
export function createResourceLocks(url: string) {
  const pool = new Pool({
    connectionString: url,
    max: 4,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });
  return {
    async run<T>(
      key: string,
      operation: (signal: AbortSignal) => Promise<T>,
    ): Promise<T> {
      const client = await pool.connect();
      const controller = new AbortController();
      const lost = () => {
        controller.abort(new Error('RESOURCE_LOCK_LOST'));
      };
      client.on('error', lost);
      client.on('end', lost);
      let locked = false;
      try {
        const deadline = Date.now() + 30000;
        while (!locked) {
          const result = await client.query<{ locked: boolean }>(
            'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',
            [key],
          );
          locked = result.rows[0]?.locked === true;
          if (!locked) {
            if (Date.now() >= deadline) throw new Error('RESOURCE_BUSY');
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }
        controller.signal.throwIfAborted();
        const result = await operation(controller.signal);
        controller.signal.throwIfAborted();
        return result;
      } finally {
        if (locked)
          await client
            .query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [key])
            .catch(() => undefined);
        client.off('error', lost);
        client.off('end', lost);
        client.release(true);
      }
    },
    stop: () => pool.end(),
  };
}
