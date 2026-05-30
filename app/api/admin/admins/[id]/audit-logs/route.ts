import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 20;

const querySchema = z.object({
  cursor: z.string().cuid().optional(),
  search: z.string().max(100).optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    cursor: searchParams.get('cursor') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  const { cursor, search } = parsed.data;

  const logs = await prisma.adminAuditLog.findMany({
    where: {
      adminId: id,
      ...(search
        ? { message: { contains: search, mode: 'insensitive' } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      type: true,
      message: true,
      createdAt: true,
    },
  });

  const hasMore = logs.length > PAGE_SIZE;
  const page = hasMore ? logs.slice(0, PAGE_SIZE) : logs;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return NextResponse.json({
    logs: page.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
    nextCursor,
  });
}
