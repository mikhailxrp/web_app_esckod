import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { checkAvailability } from '@/lib/final-report/availability';
import { prisma } from '@/lib/prisma';

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const availability = await checkAvailability(session.user.id);

    if (!availability.available && !availability.alreadySubmitted) {
      return NextResponse.json(
        { error: 'NOT_AVAILABLE', reasons: availability.reasonsBlocked },
        { status: 400 },
      );
    }

    const [questions, settings] = await Promise.all([
      prisma.finalReportQuestion.findMany({
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          orderIndex: true,
          questionText: true,
          options: true,
        },
      }),
      prisma.appSettings.findFirst({
        select: { finalReportQuestionId: true },
      }),
    ]);

    return NextResponse.json({
      questions,
      finalReportQuestionId: settings?.finalReportQuestionId ?? null,
    });
  } catch (error) {
    console.error('[GET /api/final-report/questions]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
