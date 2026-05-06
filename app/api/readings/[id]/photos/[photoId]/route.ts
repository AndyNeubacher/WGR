import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { deletePhotoFile } from '@/lib/storage';
import { currentUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ id: string; photoId: string }> },
) {
  await currentUser();
  const { id, photoId } = await ctx.params;

  const reading = await prisma.reading.findUnique({ where: { id } });
  if (!reading) return NextResponse.json({ error: 'reading not found' }, { status: 404 });
  if (reading.primaryPhotoId === photoId) {
    return NextResponse.json({ error: 'cannot delete primary photo' }, { status: 400 });
  }

  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo || photo.readingId !== id) {
    return NextResponse.json({ error: 'photo not found' }, { status: 404 });
  }

  await prisma.photo.delete({ where: { id: photoId } });
  await deletePhotoFile(photo.path);
  return NextResponse.json({ ok: true });
}
