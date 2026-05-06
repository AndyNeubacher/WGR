import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { deletePhotoFile, InvalidUploadError, savePhoto } from '@/lib/storage';
import { currentUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await currentUser();
  const { id } = await ctx.params;
  const reading = await prisma.reading.findUnique({ where: { id } });
  if (!reading) return NextResponse.json({ error: 'not found' }, { status: 404 });

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
  const caption = (fd.get('caption') as string | null) || null;

  let stored: { path: string; absolutePath: string };
  try {
    stored = await savePhoto(file);
  } catch (e) {
    if (e instanceof InvalidUploadError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  let photo;
  try {
    photo = await prisma.photo.create({
      data: { readingId: id, path: stored.path, caption },
    });
  } catch (e) {
    await deletePhotoFile(stored.path);
    throw e;
  }

  return NextResponse.json(
    {
      id: photo.id,
      caption: photo.caption,
      createdAt: photo.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
