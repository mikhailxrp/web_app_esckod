import { NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { rewindHint } from '@/lib/hints/service';
import { checkRateLimit } from '@/lib/rateLimit';

const HINTS_REWIND_RATE_LIMIT_MAX = 30;
const HINTS_REWIND_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

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
