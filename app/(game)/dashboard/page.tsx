import type { MissionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DashboardClient } from '@/components/game/DashboardClient';

export default async function DashboardPage(): Promise<React.ReactElement> {
  const slots = await prisma.missionSlot.findMany({
    where: { isActive: true },
    select: { missionType: true },
    distinct: ['missionType'],
  });

  const activeMissionTypes: MissionType[] = slots.map((s) => s.missionType);

  return <DashboardClient activeMissionTypes={activeMissionTypes} />;
}
