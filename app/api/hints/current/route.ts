import { NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { getCurrentHint } from '@/lib/hints/service';

export async function GET(): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

  try {
    const result = await getCurrentHint(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/hints/current]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
