import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoleApi, isApiResponse } from '@/lib/auth';
import { userToDto } from '@/lib/dto';
import { updateUserSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(userToDto(user));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;
  const { id } = await params;
  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.role && { role: data.role }),
      },
    });

    return NextResponse.json(userToDto(user));
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e) {
      if (e.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (e.code === 'P2002') {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 },
        );
      }
    }
    throw e;
  }
}
