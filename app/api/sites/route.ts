import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoleApi, isApiResponse } from '@/lib/auth';
import { siteToDto } from '@/lib/dto';
import { createSiteSchema } from '@/lib/validation';
import type { SiteDto } from '@/lib/dto';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;

  const sites = await prisma.site.findMany({
    orderBy: { createdAt: 'desc' },
    include: { customer: true },
  });
  const dtos: SiteDto[] = sites.map(siteToDto);
  return NextResponse.json(dtos);
}

export async function POST(req: Request) {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;

  const body = await req.json();
  const parsed = createSiteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const site = await prisma.site.create({
    data: {
      customerId: data.customerId,
      name: data.name,
      address: data.address,
    },
    include: { customer: true },
  });

  return NextResponse.json(siteToDto(site), { status: 201 });
}
