import { NextRequest, NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { getFiles } from '@/lib/rdp/service';

interface RouteParams {
  params: Promise<{ slotKey: string }>;
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

  const { slotKey } = await params;

  try {
    const outcome = await getFiles(session.user.id, slotKey);

    switch (outcome.type) {
      case 'SUCCESS':
        return NextResponse.json({
          folders: outcome.folders,
          version: outcome.version,
          triggerActivated: outcome.triggerActivated,
          completed: outcome.completed,
          ...(outcome.nextIp !== undefined && { nextIp: outcome.nextIp }),
        });
      case 'PUZZLE_NOT_SOLVED':
        return NextResponse.json({ error: 'PUZZLE_NOT_SOLVED' }, { status: 400 });
      case 'SLOT_NOT_FOUND':
        return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[GET /api/missions/rdp/[slotKey]/files]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
