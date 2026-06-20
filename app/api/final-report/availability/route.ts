import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { checkAvailability } from '@/lib/final-report/availability';

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await checkAvailability(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/final-report/availability]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
