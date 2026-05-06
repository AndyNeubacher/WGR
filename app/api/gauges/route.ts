import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { currentUser, requireRoleApi, isApiResponse } from '@/lib/auth';
import { gaugeToDto } from '@/lib/dto';
import { createGaugeSchema } from '@/lib/validation';
import type { GaugeDto } from '@/lib/dto';

export const runtime = 'nodejs';

export async function GET() {
  const user = await currentUser();
  const isManager = user.role === 'manager';

  if (isManager) {
    const gauges = await prisma.gauge.findMany({
      orderBy: { createdAt: 'desc' },
      include: { site: { include: { customer: true } } },
    });
    const dtos: GaugeDto[] = gauges.map(gaugeToDto);
    return NextResponse.json(dtos);
  } else {
    const gauges = await prisma.gauge.findMany({
      where: {
        assignments: {
          some: { technicianId: user.id },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { site: { include: { customer: true } } },
    });
    const dtos: GaugeDto[] = gauges.map(gaugeToDto);
    return NextResponse.json(dtos);
  }
}

export async function POST(req: Request) {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;
  const body = await req.json();
  const parsed = createGaugeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const gauge = await prisma.gauge.create({
    data: {
      siteId: data.siteId,
      label: data.label,
    },
    include: { site: { include: { customer: true } } },
  });

  return NextResponse.json(gaugeToDto(gauge), { status: 201 });
}
