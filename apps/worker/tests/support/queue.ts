import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

export function createQueueProbe(redisUrl: string, queueName: string) {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  return {
    connection,
    queue: new Queue(queueName, { connection, prefix: queueName }),
  };
}
