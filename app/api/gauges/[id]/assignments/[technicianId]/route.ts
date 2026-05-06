import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoleApi, isApiResponse } from '@/lib/auth';

export const runtime = 'nodejs';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; technicianId: string }> }
) {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;
  const { id, technicianId } = await params;

  try {
    await prisma.technicianGauge.delete({
      where: {
        technicianId_gaugeId: {
          technicianId,
          gaugeId: id,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    throw e;
  }
}
