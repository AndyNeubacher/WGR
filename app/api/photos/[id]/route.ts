import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readPhoto } from '@/lib/storage';
import { currentUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await ctx.params;
  const photo = await prisma.photo.findUnique({
    where: { id },
    include: { reading: { select: { technicianId: true } } },
  });
  if (!photo) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Technicians can only view photos belonging to their own readings.
  if (user.role === 'technician' && photo.reading.technicianId !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  try {
    const { buffer, contentType } = await readPhoto(photo.path);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'file missing' }, { status: 404 });
  }
}
