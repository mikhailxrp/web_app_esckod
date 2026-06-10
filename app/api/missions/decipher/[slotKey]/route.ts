import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getDecipherState } from '@/lib/decipher/service';

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
    const result = await getDecipherState(session.user.id, slotKey);

    if (result.status === 'not_found') {
      return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json(result.state);
  } catch (error) {
    console.error('[GET /api/missions/decipher/[slotKey]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
