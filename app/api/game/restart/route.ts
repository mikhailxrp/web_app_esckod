import { NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { restartGame } from '@/lib/game/restart';
import { checkRateLimit } from '@/lib/rateLimit';
import { restartGameSchema } from '@/lib/validations/restart';

const RESTART_RATE_LIMIT = 3;
const RESTART_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

  const userId = session.user.id;

  restartGameSchema.parse({});

  const allowed = checkRateLimit(
    `game-restart:${userId}`,
    RESTART_RATE_LIMIT,
    RESTART_RATE_LIMIT_WINDOW_MS,
  );

  if (!allowed) {
    return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
  }

  try {
    await restartGame(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Restart] Failed for user:', userId, error);
    return NextResponse.json({ error: 'RESTART_FAILED' }, { status: 500 });
  }
}
