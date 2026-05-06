import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { deletePhotoFile, InvalidUploadError, savePhoto } from '@/lib/storage';
import { enqueue } from '@/lib/queue';
import { currentUser } from '@/lib/auth';
import { readingToDto } from '@/lib/dto';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const user = await currentUser();
  const url = new URL(req.url);
  const gaugeId = url.searchParams.get('gaugeId');

  // If a gaugeId is supplied, validate it belongs to a gauge assigned to this technician.
  // Without this check a technician could submit readings for any gauge by guessing UUIDs.
  if (gaugeId) {
    const assignment = await prisma.technicianGauge.findUnique({
      where: { technicianId_gaugeId: { technicianId: user.id, gaugeId } },
    });
    if (!assignment) {
      return NextResponse.json(
        { error: 'Gauge is not assigned to this technician' },
        { status: 403 },
      );
    }
  }

  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 22 * 1024 * 1024) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid multipart body' }, { status: 400 });
  }
  const file = fd.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }

  let stored: { path: string; absolutePath: string };
  try {
    stored = await savePhoto(file);
  } catch (e) {
    if (e instanceof InvalidUploadError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  // Three-step transaction: create reading, create photo, link primary.
  // Reading.primaryPhotoId is unique, so this also enforces "at most one primary per reading".
  // Anyone adding a new "create reading" entry point must replicate this pattern.
  let reading;
  try {
    reading = await prisma.$transaction(async (tx) => {
      const r = await tx.reading.create({
        data: { technicianId: user.id, gaugeId, ocrStatus: 'pending' },
      });
      const p = await tx.photo.create({
        data: { readingId: r.id, path: stored.path },
      });
      const updated = await tx.reading.update({
        where: { id: r.id },
        data: { primaryPhotoId: p.id },
        include: { photos: true, primaryPhoto: true },
      });
      await enqueue('ocr', { readingId: r.id }, 0, tx);
      return updated;
    });
  } catch (e) {
    // The file is on disk but no row references it. Best-effort cleanup before
    // re-throwing — orphaned blobs would otherwise accumulate on every DB hiccup.
    await deletePhotoFile(stored.path);
    throw e;
  }

  return NextResponse.json(readingToDto(reading), { status: 201 });
}

export async function GET() {
  const user = await currentUser();
  const readings = await prisma.reading.findMany({
    where: user.role === 'technician' ? { technicianId: user.id } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { photos: true, primaryPhoto: true },
  });
  return NextResponse.json(readings.map(readingToDto));
}
