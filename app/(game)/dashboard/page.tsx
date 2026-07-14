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

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session!.user.id },
    select: { onboardingDone: true },
  });

  const appSettings = await prisma.appSettings.findFirst({
    select: { crackLaunchHint: true, decipherLaunchHint: true, rdpLaunchHint: true },
  });

  const missionLaunchHints: Record<MissionType, string | null> = {
    CRACK: appSettings?.crackLaunchHint || null,
    DECIPHER: appSettings?.decipherLaunchHint || null,
    RDP: appSettings?.rdpLaunchHint || null,
  };

  return (
    <DashboardClient
      activeMissionTypes={activeMissionTypes}
      playerLogin={playerLogin}
      onboardingDone={user.onboardingDone}
      missionLaunchHints={missionLaunchHints}
    />
  );
}
