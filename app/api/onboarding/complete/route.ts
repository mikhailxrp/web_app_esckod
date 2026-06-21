import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { renderLogMessage } from '@/lib/operationLog';

export async function POST(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingDone: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.onboardingDone) {
      return NextResponse.json({ success: true, alreadyCompleted: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { onboardingDone: true },
      });

      const message = renderLogMessage('onboarding_completed');

      await tx.operationLog.create({
        data: {
          userId,
          type: 'INFO',
          message,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/onboarding/complete]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
