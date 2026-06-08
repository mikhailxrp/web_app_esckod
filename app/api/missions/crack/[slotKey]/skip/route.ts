import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { skipCrack } from '@/lib/crack/service';

interface RouteParams {
  params: Promise<{ slotKey: string }>;
}

export async function POST(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slotKey } = await params;

  try {
    const outcome = await skipCrack(session.user.id, slotKey);

    switch (outcome.status) {
      case 'ok':
        return NextResponse.json(outcome.result);
      case 'not_found':
        return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
      case 'cannot_skip':
        return NextResponse.json({ error: 'CANNOT_SKIP' }, { status: 400 });
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[POST /api/missions/crack/[slotKey]/skip]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
