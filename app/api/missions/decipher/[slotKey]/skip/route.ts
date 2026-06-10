import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { skipDecipher } from '@/lib/decipher/service';
import type { DecipherSkipOutcome } from '@/types/decipher';

interface RouteParams {
  params: Promise<{ slotKey: string }>;
}

function successResponse(outcome: Extract<DecipherSkipOutcome, { type: 'SUCCESS' }>): NextResponse {
  return NextResponse.json({
    success: true,
    folderPassword: outcome.folderPassword,
    folderPath: outcome.folderPath,
  });
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
    const outcome = await skipDecipher(session.user.id, slotKey);

    switch (outcome.type) {
      case 'SUCCESS':
        return successResponse(outcome);
      case 'CANNOT_SKIP':
        return NextResponse.json({ error: 'CANNOT_SKIP' }, { status: 400 });
      case 'SLOT_NOT_FOUND':
        return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[POST /api/missions/decipher/[slotKey]/skip]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
