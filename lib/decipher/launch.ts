import 'server-only';

import { prisma } from '@/lib/prisma';

export interface DecipherLaunchMatch {
  slotKey: string;
  slotId: string;
}

/**
 * Ищет активный DECIPHER-слот по точному совпадению folderPath + cipherKey.
 * Возвращает null, если совпадения нет (клиенту не сообщается, какое поле неверно).
 */
export async function findActiveDecipherSlot(
  folderPath: string,
  cipherKey: string,
): Promise<DecipherLaunchMatch | null> {
  const slot = await prisma.missionSlot.findFirst({
    where: {
      missionType: 'DECIPHER',
      isActive: true,
      folderPath,
      cipherKey,
    },
    select: { id: true, slotKey: true },
  });

  if (!slot) {
    return null;
  }

  return { slotKey: slot.slotKey, slotId: slot.id };
}
