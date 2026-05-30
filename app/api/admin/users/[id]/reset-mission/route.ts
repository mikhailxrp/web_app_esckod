import { NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: Request,
  _context: RouteContext,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(
    { error: 'NOT_IMPLEMENTED: доступно после реализации миссий (Фаза 10+)' },
    { status: 501 },
  );
}
