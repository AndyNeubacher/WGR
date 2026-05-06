import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoleApi, isApiResponse } from '@/lib/auth';
import { z } from 'zod';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;
  const { id } = await params;

  const assignments = await prisma.technicianGauge.findMany({
    where: { gaugeId: id },
    include: { technician: true },
  });

  return NextResponse.json(
    assignments.map((a) => ({
      technicianId: a.technician.id,
      technicianName: a.technician.name,
      assignedAt: a.assignedAt.toISOString(),
    })),
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;
  const { id } = await params;
  const body = await req.json();

  const schema = z.object({
    technicianId: z.string().uuid(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Validate assignee is actually a technician — managers should not be assigned gauges.
  const technician = await prisma.user.findUnique({
    where: { id: data.technicianId },
    select: { role: true },
  });
  if (!technician) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (technician.role !== 'technician') {
    return NextResponse.json(
      { error: 'Only technicians can be assigned to gauges' },
      { status: 400 },
    );
  }

  try {
    await prisma.technicianGauge.create({
      data: {
        technicianId: data.technicianId,
        gaugeId: id,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e) {
      if (e.code === 'P2002') {
        return NextResponse.json({ error: 'Assignment already exists' }, { status: 409 });
      }
      if (e.code === 'P2003') {
        return NextResponse.json({ error: 'Gauge not found' }, { status: 404 });
      }
    }
    throw e;
  }
}
