import 'server-only';

import { LogType, Prisma } from '@prisma/client';

import { renderLogMessage } from '@/lib/operationLog';
import { prisma } from '@/lib/prisma';

export async function restartGame(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

    const { email } = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });

    await tx.missionProgress.deleteMany({ where: { userId } });
    await tx.crackSession.deleteMany({ where: { userId } });
    await tx.operationLog.deleteMany({ where: { userId } });
    await tx.userHintProgress.deleteMany({ where: { userId } });

    await tx.chatState.update({
      where: { userId },
      data: {
        currentDetectiveMessageId: null,
        currentMarinaMessageId: null,
        playerChoices: {},
        finalChoice: null,
        detectiveFinished: false,
        marinaFinished: false,
        firedTriggers: [],
        version: { increment: 1 },
      },
    });

    await tx.gameProgress.update({
      where: { userId },
      data: {
        marinaTriggered: false,
        finalReportDone: false,
        finalScore: null,
        finalReportChoice: null,
        finalReportAnswers: Prisma.DbNull,
        version: { increment: 1 },
      },
    });

    await tx.operationLog.create({
      data: {
        userId,
        type: LogType.INFO,
        message: renderLogMessage('game_restarted', {}),
      },
    });

    await tx.adminAuditLog.create({
      data: {
        type: 'user_restart',
        userId,
        message: `Игрок ${email} выполнил перезапуск игры`,
      },
    });
  });
}
