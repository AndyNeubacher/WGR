import 'dotenv/config';
import { prisma } from '@/lib/db';
import { processOcrJob } from '@/lib/jobs/ocr';

const WORKER_ID = process.env.WORKER_ID ?? `worker-${process.pid}`;
const POLL_INTERVAL_MS = 2000;
const LOCK_DURATION_MS = 60_000;
const MAX_ATTEMPTS = 5;

async function claimJob() {
  const now = new Date();
  // A row is claimable if either:
  //   - status='pending' AND its runAt has come due, OR
  //   - status='running' AND its lockedUntil has expired (a previous worker died mid-job).
  const candidate = await prisma.job.findFirst({
    where: {
      OR: [
        { status: 'pending', runAt: { lte: now } },
        { status: 'running', lockedUntil: { lt: now } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!candidate) return null;

  // Atomic claim — the WHERE re-checks the same condition so two workers
  // racing for the same row can't both succeed. updateMany returns count=1
  // for the winner and count=0 for losers.
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
  if (result.count !== 1) return null;
  return prisma.job.findUnique({ where: { id: candidate.id } });
}

async function tick() {
  const job = await claimJob();
  if (!job) return;
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
  while (!stopping) {
    try {
      await tick();
    } catch (e) {
      console.error('[worker] tick error', e);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  await prisma.$disconnect();
  console.log('[worker] stopped');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
