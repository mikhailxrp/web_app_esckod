import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getOrCreatePuzzleState } from '@/lib/rdp/service';

interface RouteParams {
  params: Promise<{ slotKey: string }>;
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slotKey } = await params;

  try {
    const outcome = await getOrCreatePuzzleState(session.user.id, slotKey);

    switch (outcome.type) {
      case 'SUCCESS':
        return NextResponse.json({
          puzzleField: outcome.puzzleField,
          version: outcome.version,
          ...(outcome.timerSeconds !== undefined && {
            timerSeconds: outcome.timerSeconds,
            timerStartedAt: outcome.timerStartedAt,
            timerRemaining: outcome.timerRemaining,
          }),
        });
      case 'SLOT_NOT_FOUND':
        return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[GET /api/missions/rdp/[slotKey]/puzzle-state]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
