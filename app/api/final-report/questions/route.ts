import { NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { checkAvailability } from '@/lib/final-report/availability';
import { prisma } from '@/lib/prisma';

export async function GET(): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

  try {
    const availability = await checkAvailability(session.user.id);

    if (!availability.available && !availability.alreadySubmitted) {
      return NextResponse.json(
        { error: 'NOT_AVAILABLE', reasons: availability.reasonsBlocked },
        { status: 400 },
      );
    }

    const [questions, settings, progress] = await Promise.all([
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
      prisma.gameProgress.findUnique({
        where: { userId: session.user.id },
        select: { version: true },
      }),
    ]);

    return NextResponse.json({
      questions,
      finalReportQuestionId: settings?.finalReportQuestionId ?? null,
      version: progress?.version ?? 0,
    });
  } catch (error) {
    console.error('[GET /api/final-report/questions]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
