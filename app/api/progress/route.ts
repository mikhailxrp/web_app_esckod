import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const [gameProgress, completedMissions, activeSlots] = await Promise.all([
    prisma.gameProgress.findUnique({
      where: { userId },
      select: {
        marinaTriggered: true,
        finalReportDone: true,
        finalScore: true,
        version: true,
      },
    }),
    prisma.missionProgress.findMany({
      where: { userId, completed: true },
      select: {
        completedAt: true,
        slot: {
          select: {
            id: true,
            slotKey: true,
            missionType: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.missionSlot.findMany({
      where: { isActive: true },
      select: { missionType: true },
      distinct: ['missionType'],
    }),
  ]);

  if (!gameProgress) {
    return NextResponse.json({ error: 'Progress not found' }, { status: 404 });
  }

  return NextResponse.json({
    gameProgress,
    completedMissions: completedMissions.map((mission) => ({
      slotId: mission.slot.id,
      slotKey: mission.slot.slotKey,
      missionType: mission.slot.missionType,
      completedAt: mission.completedAt,
    })),
    activeMissionTypes: activeSlots.map((slot) => slot.missionType),
  });
}
