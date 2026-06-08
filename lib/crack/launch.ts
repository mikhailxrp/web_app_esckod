import 'server-only';

import { prisma } from '@/lib/prisma';

export interface CrackLaunchMatch {
  slotKey: string;
  slotId: string;
}

/**
 * Ищет активный CRACK-слот по точному совпадению targetUrl + targetEmail.
 * Возвращает null, если совпадения нет (клиенту не сообщается, какое поле неверно).
 */
export async function findActiveCrackSlot(
  targetUrl: string,
  targetEmail: string,
): Promise<CrackLaunchMatch | null> {
  const slot = await prisma.missionSlot.findFirst({
    where: {
      missionType: 'CRACK',
      isActive: true,
      targetUrl,
      targetEmail,
    },
    select: { id: true, slotKey: true },
  });

  if (!slot) {
    return null;
  }

  return { slotKey: slot.slotKey, slotId: slot.id };
}
