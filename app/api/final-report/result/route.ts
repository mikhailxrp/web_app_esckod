import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getResult } from '@/lib/final-report/result';

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
