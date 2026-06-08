import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { rewindHint } from '@/lib/hints/service';
import { checkRateLimit } from '@/lib/rateLimit';

const HINTS_REWIND_RATE_LIMIT_MAX = 30;
const HINTS_REWIND_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowed = checkRateLimit(
    `hints-rewind:${session.user.id}`,
    HINTS_REWIND_RATE_LIMIT_MAX,
    HINTS_REWIND_RATE_LIMIT_WINDOW_MS,
  );

  if (!allowed) {
    return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
  }

  try {
    const result = await rewindHint(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/hints/rewind]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
