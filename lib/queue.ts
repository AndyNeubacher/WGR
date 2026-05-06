import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export async function enqueue(
  type: string,
  payload: Prisma.InputJsonValue,
  delayMs = 0,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  await db.job.create({
    data: {
      type,
      payloadJson: payload,
      runAt: new Date(Date.now() + delayMs),
    },
  });
}
