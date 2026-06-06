import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getCurrentHint } from '@/lib/hints/service';

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await getCurrentHint(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/hints/current]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
