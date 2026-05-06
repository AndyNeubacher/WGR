import 'dotenv/config';
import { prisma } from '@/lib/db';
import { processOcrJob } from '@/lib/jobs/ocr';

const WORKER_ID = process.env.WORKER_ID ?? `worker-${process.pid}`;
const POLL_INTERVAL_MS = 2000;
const LOCK_DURATION_MS = 60_000;
const MAX_ATTEMPTS = 5;

async function claimJob() {
  const now = new Date();
  // Fetch a small batch of candidates to reduce contention if multiple workers
  // race for the queue.
  const candidates = await prisma.job.findMany({
    where: {
      OR: [
        { status: 'pending', runAt: { lte: now } },
        { status: 'running', lockedUntil: { lt: now } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    // Atomic claim
    const result = await prisma.job.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: 'pending' },
          { status: 'running', lockedUntil: { lt: now } },
        ],
      },
      data: {
        status: 'running',
        lockedBy: WORKER_ID,
        lockedUntil: new Date(Date.now() + LOCK_DURATION_MS),
        attempts: { increment: 1 },
      },
    });
    if (result.count === 1) {
      return prisma.job.findUnique({ where: { id: candidate.id } });
    }
  }
  return 'retry';
}

async function tick(): Promise<boolean> {
  const job = await claimJob();
  if (!job) return false;
  if (job === 'retry') return true;

  console.log(`[worker] processing ${job.type} ${job.id} (attempt ${job.attempts})`);
  try {
    if (job.type === 'ocr') {
      await processOcrJob(job.payloadJson as { readingId: string });
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'done', lockedBy: null, lockedUntil: null },
    });
    console.log(`[worker] done ${job.id}`);
  } catch (e) {
    const isLast = job.attempts >= MAX_ATTEMPTS;
    const backoffMs = Math.pow(2, job.attempts) * 1000;
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: isLast ? 'failed' : 'pending',
        lastError: String((e as Error)?.stack ?? e),
        runAt: new Date(Date.now() + backoffMs),
        lockedBy: null,
        lockedUntil: null,
      },
    });
    console.warn(`[worker] failed ${job.id}: ${(e as Error)?.message}`);
  }
  return true;
}

let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
});
process.on('SIGTERM', () => {
  stopping = true;
});

async function main() {
  console.log(`[worker] ${WORKER_ID} started`);
  try {
    while (!stopping) {
      try {
        const hasMore = await tick();
        if (!hasMore && !stopping) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
      } catch (e) {
        console.error('[worker] tick error', e);
        if (!stopping) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
      }
    }
  } finally {
    await prisma.$disconnect();
    console.log('[worker] stopped');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
