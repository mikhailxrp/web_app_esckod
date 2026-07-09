import { NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await context.params;

  const [user, totalActiveSlots] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isBlocked: true,
        onboardingDone: true,
        consentMarketing: true,
        consentPolicy: true,
        createdAt: true,
        accessKey: {
          select: {
            key: true,
            isBlocked: true,
          },
        },
        progress: {
          select: {
            marinaTriggered: true,
            finalReportDone: true,
            finalScore: true,
          },
        },
        chatState: {
          select: {
            playerChoices: true,
            finalChoice: true,
            detectiveFinished: true,
            marinaFinished: true,
            currentDetectiveMessage: {
              select: {
                code: true,
                text: true,
              },
            },
            currentMarinaMessage: {
              select: {
                code: true,
                text: true,
              },
            },
          },
        },
        missionProgress: {
          select: {
            completed: true,
            completedAt: true,
            metadata: true,
            slot: {
              select: {
                slotKey: true,
              },
            },
          },
          orderBy: {
            slot: {
              orderIndex: 'asc',
            },
          },
        },
        crackSessions: {
          select: {
            attemptsUsed: true,
            maxAttempts: true,
            slot: {
              select: {
                slotKey: true,
              },
            },
          },
        },
        hintProgress: {
          select: {
            lastSeenHintIndex: true,
          },
        },
        gameCompletions: {
          select: {
            id: true,
            completedAt: true,
            finalScore: true,
            durationSeconds: true,
            ipAddress: true,
            userAgent: true,
          },
          orderBy: { completedAt: 'desc' },
        },
        operationLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            message: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            operationLogs: true,
          },
        },
      },
    }),
    prisma.missionSlot.count({ where: { isActive: true } }),
  ]);

  if (!user) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const {
    progress,
    chatState,
    missionProgress,
    crackSessions,
    hintProgress,
    gameCompletions,
    operationLogs,
    _count,
    ...userFields
  } = user;

  return NextResponse.json({
    user: userFields,
    gameProgress: progress,
    chatState: chatState
      ? {
          currentDetectiveMessage: chatState.currentDetectiveMessage,
          currentMarinaMessage: chatState.currentMarinaMessage,
          playerChoices: chatState.playerChoices,
          finalChoice: chatState.finalChoice,
          detectiveFinished: chatState.detectiveFinished,
          marinaFinished: chatState.marinaFinished,
        }
      : null,
    missionProgress: missionProgress.map((item) => ({
      slotKey: item.slot.slotKey,
      completed: item.completed,
      completedAt: item.completedAt,
      metadata: item.metadata,
    })),
    crackSessions: crackSessions.map((item) => ({
      slotKey: item.slot.slotKey,
      attemptsUsed: item.attemptsUsed,
      maxAttempts: item.maxAttempts,
    })),
    hintProgress,
    completions: gameCompletions,
    totalActiveSlots,
    logsCount: _count.operationLogs,
    recentLogs: operationLogs,
  });
}
