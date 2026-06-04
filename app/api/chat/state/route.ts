import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getChatState } from '@/lib/chat/state';

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const state = await getChatState(session.user.id);
    return NextResponse.json(state);
  } catch (error) {
    console.error('[GET /api/chat/state]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
