import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export function createQueueProbe(
  redisUrl: string,
  queueName: string,
  prefix = queueName,
) {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  const queue = new Queue(queueName, { connection, prefix });
  return {
    connection,
    queue,
    async close() {
      await queue.obliterate({ force: true });
      await queue.close();
      connection.disconnect();
    },
  };
}
