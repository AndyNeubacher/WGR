import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireRoleApi, isApiResponse } from '@/lib/auth';
import { userToDto } from '@/lib/dto';
import { createUserSchema } from '@/lib/validation';
import type { UserDto } from '@/lib/dto';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });
  const dtos: UserDto[] = users.map(userToDto);
  return NextResponse.json(dtos);
}

export async function POST(req: Request) {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const hashedPassword = await hash(data.password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: hashedPassword,
        role: data.role,
      },
    });

    return NextResponse.json(userToDto(user), { status: 201 });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }
    throw e;
  }
}
