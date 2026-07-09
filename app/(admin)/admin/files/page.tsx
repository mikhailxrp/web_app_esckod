import React from 'react';
import { prisma } from '@/lib/prisma';
import { FilesPageClient } from '@/components/admin/files/FilesPageClient';
import type { RdpSlotData, FolderPasswordMap } from '@/types/admin-files';

export const metadata = {
  title: 'Файлы РДП',
};

export default async function FilesPage(): Promise<React.ReactElement> {
  const slots = await prisma.missionSlot.findMany({
    where: { missionType: 'RDP' },
    include: { rdpFiles: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });

  const decipherSlots = await prisma.missionSlot.findMany({
    where: { missionType: 'DECIPHER' },
    select: {
      unlocksRdpFolder: true,
      unlocksRdpSlotKey: true,
      folderPassword: true,
    },
  });

  const folderPasswords: FolderPasswordMap = {};
  for (const ds of decipherSlots) {
    if (ds.unlocksRdpSlotKey && ds.unlocksRdpFolder) {
      folderPasswords[`${ds.unlocksRdpSlotKey}::${ds.unlocksRdpFolder}`] =
        ds.folderPassword ?? null;
    }
  }

  const serialized: RdpSlotData[] = slots.map((slot) => ({
    id: slot.id,
    name: slot.displayName,
    slotKey: slot.slotKey,
    files: slot.rdpFiles.map((f) => ({
      id: f.id,
      name: f.name,
      url: f.url,
      folder: f.folder,
      isLocked: f.isLocked,
      createdAt: f.createdAt.toISOString(),
    })),
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-white">
        Файлы РДП
      </h1>
      <FilesPageClient slots={serialized} folderPasswords={folderPasswords} />
    </div>
  );
}
