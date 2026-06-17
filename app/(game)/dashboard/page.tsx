import type { MissionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { DashboardClient } from '@/components/game/DashboardClient';

export default async function DashboardPage(): Promise<React.ReactElement> {
  const session = await auth();

  const slots = await prisma.missionSlot.findMany({
    where: { isActive: true },
    select: { missionType: true },
    distinct: ['missionType'],
  });

  const activeMissionTypes: MissionType[] = slots.map((s) => s.missionType);
  const playerLogin = session?.user?.name ?? session?.user?.email ?? 'АГЕНТ';

  return (
    <DashboardClient
      activeMissionTypes={activeMissionTypes}
      playerLogin={playerLogin}
    />
  );
}
