import { NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { getResult } from '@/lib/final-report/result';

export async function GET(): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

  try {
    const result = await getResult(session.user.id);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.error, ...(result.error.details && { details: result.error.details }) },
        { status: result.error.status },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('[GET /api/final-report/result]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
