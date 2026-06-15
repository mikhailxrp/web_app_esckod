import { NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';

export async function POST(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({ select: { id: true } });

  if (users.length === 0) {
    return NextResponse.json({ success: true, affectedUsers: 0 });
  }

  const userIds = users.map((u) => u.id);

  await prisma.$transaction(async (tx) => {
    await tx.missionProgress.deleteMany({ where: { userId: { in: userIds } } });
    await tx.crackSession.deleteMany({ where: { userId: { in: userIds } } });
    await tx.operationLog.deleteMany({ where: { userId: { in: userIds } } });
    await tx.userHintProgress.deleteMany({ where: { userId: { in: userIds } } });

    await tx.chatState.updateMany({
      where: { userId: { in: userIds } },
      data: {
        currentDetectiveMessageId: null,
        currentMarinaMessageId: null,
        playerChoices: {},
        finalChoice: null,
        detectiveFinished: false,
        marinaFinished: false,
      },
    });

    await tx.gameProgress.updateMany({
      where: { userId: { in: userIds } },
      data: {
        marinaTriggered: false,
        finalReportDone: false,
        finalScore: null,
      },
    });

    await tx.operationLog.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: 'INFO' as const,
        message: '[dev] Прогресс сброшен администратором',
      })),
    });

    await tx.adminAuditLog.create({
      data: {
        type: 'dev_reset_all',
        adminId: session.user.id,
        message: `Администратор сбросил прогресс всех игроков (${userIds.length} чел.)`,
        metadata: { affectedCount: userIds.length },
      },
    });
  });

  return NextResponse.json({ success: true, affectedUsers: userIds.length });
}
