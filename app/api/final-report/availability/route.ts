import { NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { checkAvailability } from '@/lib/final-report/availability';

export async function GET(): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

  try {
    const result = await checkAvailability(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/final-report/availability]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
