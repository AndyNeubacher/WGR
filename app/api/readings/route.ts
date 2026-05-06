import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { deletePhotoFile, InvalidUploadError, savePhoto } from '@/lib/storage';
import { enqueue } from '@/lib/queue';
import { currentUser } from '@/lib/auth';
import { readingToDto } from '@/lib/dto';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const user = await currentUser();
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
        data: { technicianId: user.id, ocrStatus: 'pending' },
      });
      const p = await tx.photo.create({
        data: { readingId: r.id, path: stored.path },
      });
      return tx.reading.update({
        where: { id: r.id },
        data: { primaryPhotoId: p.id },
        include: { photos: true, primaryPhoto: true },
      });
    });
  } catch (e) {
    // The file is on disk but no row references it. Best-effort cleanup before
    // re-throwing — orphaned blobs would otherwise accumulate on every DB hiccup.
    await deletePhotoFile(stored.path);
    throw e;
  }

  await enqueue('ocr', { readingId: reading.id });

  return NextResponse.json(readingToDto(reading), { status: 201 });
}

export async function GET() {
  await currentUser();
  const readings = await prisma.reading.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { photos: true, primaryPhoto: true },
  });
  return NextResponse.json(readings.map(readingToDto));
}
