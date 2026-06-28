import { NextRequest, NextResponse } from 'next/server';
import { requirePlayer } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';

const DEFAULT_LOG_LIMIT = 100;
const MAX_LOG_LIMIT = 500;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

  const { searchParams } = new URL(req.url);
  const rawLimit = Number(searchParams.get('limit'));
  const limit = Math.min(
    Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : DEFAULT_LOG_LIMIT,
    MAX_LOG_LIMIT,
  );

  const logs = await prisma.operationLog.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      message: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ logs });
}
