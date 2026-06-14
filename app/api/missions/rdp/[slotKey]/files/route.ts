import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getFiles } from '@/lib/rdp/service';

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
    const outcome = await getFiles(session.user.id, slotKey);

    switch (outcome.type) {
      case 'SUCCESS':
        return NextResponse.json({
          folders: outcome.folders,
          version: outcome.version,
          triggerActivated: outcome.triggerActivated,
          completed: outcome.completed,
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
