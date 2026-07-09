import { NextRequest, NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { getCrackState } from '@/lib/crack/service';

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
    const result = await getCrackState(session.user.id, slotKey);

    if (result.status === 'not_found') {
      return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(result.state);
  } catch (error) {
    console.error('[GET /api/missions/crack/[slotKey]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
