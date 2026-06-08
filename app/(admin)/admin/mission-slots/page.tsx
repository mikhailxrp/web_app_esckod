import React from 'react';
import { prisma } from '@/lib/prisma';
import { MissionSlotsTable } from '@/components/admin/mission-slots/MissionSlotsTable';
import type { MissionSlotListItem } from '@/types/admin-mission-slots';

export const metadata = {
  title: 'Управление миссиями',
};

export default async function MissionSlotsPage(): Promise<React.ReactElement> {
  const raw = await prisma.missionSlot.findMany({
    orderBy: { orderIndex: 'asc' },
    select: {
      id: true,
      slotKey: true,
      missionType: true,
      displayName: true,
      orderIndex: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          missionProgresses: { where: { completed: true } },
        },
      },
    },
  });

  const slots: MissionSlotListItem[] = raw.map((s) => ({
    id: s.id,
    slotKey: s.slotKey,
    missionType: s.missionType,
    displayName: s.displayName,
    orderIndex: s.orderIndex,
    isActive: s.isActive,
    completionsCount: s._count.missionProgresses,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-white">
        Управление миссиями
      </h1>
      <MissionSlotsTable initialSlots={slots} />
    </div>
  );
}
