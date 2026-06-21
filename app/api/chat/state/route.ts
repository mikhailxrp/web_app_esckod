import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getChatState } from '@/lib/chat/state';
import { applyTemplateToView } from '@/lib/chat/template';
import { prisma } from '@/lib/prisma';

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { email: true, onboardingDone: true },
    });
    const state = await getChatState(session.user.id, user.onboardingDone);
    const vars = { email: user.email };

    return NextResponse.json({
      ...state,
      detective: {
        ...state.detective,
        currentMessage: state.detective.currentMessage
          ? applyTemplateToView(state.detective.currentMessage, vars)
          : null,
      },
      marina: {
        ...state.marina,
        currentMessage: state.marina.currentMessage
          ? applyTemplateToView(state.marina.currentMessage, vars)
          : null,
      },
    });
  } catch (error) {
    console.error('[GET /api/chat/state]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
