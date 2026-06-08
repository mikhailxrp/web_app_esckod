import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { advanceHint } from '@/lib/hints/service';
import { checkRateLimit } from '@/lib/rateLimit';

const HINTS_ADVANCE_RATE_LIMIT_MAX = 30;
const HINTS_ADVANCE_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowed = checkRateLimit(
    `hints-advance:${session.user.id}`,
    HINTS_ADVANCE_RATE_LIMIT_MAX,
    HINTS_ADVANCE_RATE_LIMIT_WINDOW_MS,
  );

  if (!allowed) {
    return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
  }

  try {
    const result = await advanceHint(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/hints/advance]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
