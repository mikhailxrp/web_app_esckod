import React from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { MissionSlotForm } from '@/components/admin/mission-slots/MissionSlotForm';
import type { ActiveRdpSlot, MissionSlotDetail } from '@/types/admin-mission-slots';

export const metadata = {
  title: 'Редактирование миссии',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditMissionSlotPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { id } = await params;

  const raw = await prisma.missionSlot.findUnique({
    where: { id },
    select: {
      id: true,
      slotKey: true,
      missionType: true,
      displayName: true,
      orderIndex: true,
      isActive: true,
      hintText: true,
      targetUrl: true,
      targetEmail: true,
      resultPassword: true,
      crackMaxAttempts: true,

      cipherType: true,
      encryptedWord: true,
      cipherKey: true,
      folderPassword: true,
      folderPath: true,
      unlocksRdpFolder: true,
      unlocksRdpSlotKey: true,
      correctIp: true,
      rdpScenario: true,
      timerSeconds: true,
      rdpPuzzleGridSize: true,
      logSubjectName: true,
      nextRdpSlotKey: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          missionProgresses: { where: { completed: true } },
        },
      },
    },
  });

  if (!raw) {
    notFound();
  }

  const slot: MissionSlotDetail = {
    id: raw.id,
    slotKey: raw.slotKey,
    missionType: raw.missionType,
    displayName: raw.displayName,
    orderIndex: raw.orderIndex,
    isActive: raw.isActive,
    hintText: raw.hintText,
    targetUrl: raw.targetUrl,
    targetEmail: raw.targetEmail,
    resultPassword: raw.resultPassword,
    crackMaxAttempts: raw.crackMaxAttempts,
    cipherType: raw.cipherType,
    encryptedWord: raw.encryptedWord,
    cipherKey: raw.cipherKey,
    folderPassword: raw.folderPassword,
    folderPath: raw.folderPath,
    unlocksRdpFolder: raw.unlocksRdpFolder,
    unlocksRdpSlotKey: raw.unlocksRdpSlotKey,
    correctIp: raw.correctIp,
    rdpScenario: raw.rdpScenario,
    timerSeconds: raw.timerSeconds,
    rdpPuzzleGridSize: raw.rdpPuzzleGridSize,
    logSubjectName: raw.logSubjectName,
    nextRdpSlotKey: raw.nextRdpSlotKey,
    completionsCount: raw._count.missionProgresses,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };

  const rawRdpSlots = await prisma.missionSlot.findMany({
    where: { missionType: 'RDP', isActive: true, NOT: { id } },
    select: { slotKey: true, displayName: true },
    orderBy: { orderIndex: 'asc' },
  });

  const activeRdpSlots: ActiveRdpSlot[] = rawRdpSlots;

  return <MissionSlotForm mode="edit" slot={slot} activeRdpSlots={activeRdpSlots} />;
}
