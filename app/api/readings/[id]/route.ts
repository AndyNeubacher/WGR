import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { verifyReadingSchema } from '@/lib/validation';
import { readingToDto } from '@/lib/dto';

export const runtime = 'nodejs';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await ctx.params;
  const reading = await prisma.reading.findUnique({
    where: { id },
    include: { photos: true, primaryPhoto: true },
  });
  if (!reading) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Technicians can only view their own readings; managers see everything.
  if (user.role === 'technician' && reading.technicianId !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  return NextResponse.json(readingToDto(reading));
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await ctx.params;

  // Verify ownership before allowing update — technicians can only modify their own readings.
  const existing = await prisma.reading.findUnique({
    where: { id },
    select: { technicianId: true },
  });
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (user.role === 'technician' && existing.technicianId !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = verifyReadingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const reading = await prisma.reading.update({
    where: { id },
    data: {
      serialNumber: data.serialNumber ?? null,
      consumedVolume: data.consumedVolume ?? null,
      technicianNote: data.technicianNote ?? null,
      verifiedAt: data.verified === true ? new Date() : undefined,
    },
    include: { photos: true, primaryPhoto: true },
  });
  return NextResponse.json(readingToDto(reading));
}
