import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { completeDecipher } from '@/lib/decipher/service';

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
    const outcome = await completeDecipher(session.user.id, slotKey);

    switch (outcome.type) {
      case 'SUCCESS':
        return NextResponse.json({
          success: true,
          folderPassword: outcome.folderPassword,
          folderPath: outcome.folderPath,
        });
      case 'NOT_SOLVED':
        return NextResponse.json({ error: 'NOT_SOLVED' }, { status: 400 });
      case 'SLOT_NOT_FOUND':
        return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[POST /api/missions/decipher/[slotKey]/complete]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
