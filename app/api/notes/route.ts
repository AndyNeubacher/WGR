import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRoleApi, isApiResponse } from '@/lib/auth';
import { z } from 'zod';
import type { NoteDto } from '@/lib/dto';

export const runtime = 'nodejs';

const noteSchema = z.object({
  targetType: z.enum(['photo', 'serialNumber', 'gauge', 'site']),
  targetId: z.string().uuid(),
  body: z.string().min(1).max(5000),
});

export async function GET(req: Request) {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;

  const url = new URL(req.url);
  const targetType = url.searchParams.get('targetType');
  const targetId = url.searchParams.get('targetId');

  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'targetType and targetId required' }, { status: 400 });
  }

  const notes = await prisma.note.findMany({
    where: { targetType, targetId },
    orderBy: { createdAt: 'desc' },
  });

  const dtos: NoteDto[] = notes.map((n) => ({
    id: n.id,
    targetType: n.targetType,
    targetId: n.targetId,
    body: n.body,
    authorId: n.authorId,
    createdAt: n.createdAt.toISOString(),
  }));

  return NextResponse.json(dtos);
}

export async function POST(req: Request) {
  const guard = await requireRoleApi('manager');
  if (isApiResponse(guard)) return guard;

  const body = await req.json();
  const parsed = noteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const note = await prisma.note.create({
    data: {
      targetType: data.targetType,
      targetId: data.targetId,
      body: data.body,
      authorId: guard.id,
    },
  });

  const dto: NoteDto = {
    id: note.id,
    targetType: note.targetType,
    targetId: note.targetId,
    body: note.body,
    authorId: note.authorId,
    createdAt: note.createdAt.toISOString(),
  };

  return NextResponse.json(dto, { status: 201 });
}
