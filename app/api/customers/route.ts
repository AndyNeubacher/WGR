import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoleApi, isApiResponse } from '@/lib/auth';
import { customerToDto } from '@/lib/dto';
import { createCustomerSchema } from '@/lib/validation';
import type { CustomerDto } from '@/lib/dto';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
  });
  const dtos: CustomerDto[] = customers.map(customerToDto);
  return NextResponse.json(dtos);
}

export async function POST(req: Request) {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;

  const body = await req.json();
  const parsed = createCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const customer = await prisma.customer.create({
    data: { name: data.name },
  });

  return NextResponse.json(customerToDto(customer), { status: 201 });
}
