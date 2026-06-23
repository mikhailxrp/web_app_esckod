import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { restartGame } from '@/lib/game/restart';
import { checkRateLimit } from '@/lib/rateLimit';
import { restartGameSchema } from '@/lib/validations/restart';

const RESTART_RATE_LIMIT = 3;
const RESTART_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
