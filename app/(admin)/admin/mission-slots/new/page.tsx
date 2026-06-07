import React from 'react';
import { prisma } from '@/lib/prisma';
import { MissionSlotForm } from '@/components/admin/mission-slots/MissionSlotForm';
import type { ActiveRdpSlot } from '@/types/admin-mission-slots';

export const metadata = {
  title: 'Добавление миссии',
};

export default async function NewMissionSlotPage(): Promise<React.ReactElement> {
  const rawSlots = await prisma.missionSlot.findMany({
    where: { missionType: 'RDP', isActive: true },
    select: { slotKey: true, displayName: true },
    orderBy: { orderIndex: 'asc' },
  });

  const activeRdpSlots: ActiveRdpSlot[] = rawSlots;

  return <MissionSlotForm mode="create" activeRdpSlots={activeRdpSlots} />;
}
