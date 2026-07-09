import { NextRequest, NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { completeCrack } from '@/lib/crack/service';

interface RouteParams {
  params: Promise<{ slotKey: string }>;
}

export async function POST(
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
    const outcome = await completeCrack(session.user.id, slotKey);

    switch (outcome.status) {
      case 'ok':
        return NextResponse.json(outcome.result);
      case 'not_found':
        return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
      case 'not_solved':
        return NextResponse.json({ error: 'NOT_SOLVED' }, { status: 400 });
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[POST /api/missions/crack/[slotKey]/complete]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
