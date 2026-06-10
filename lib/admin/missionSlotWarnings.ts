import {
  type MissionSlot,
  MissionType,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface SlotWarning {
  code: string;
  message: string;
}

type DbClient = Prisma.TransactionClient;

function getDbClient(tx?: DbClient): DbClient {
  return tx ?? prisma;
}

export async function getMissionSlotWarnings(
  slot: MissionSlot,
  tx?: DbClient,
): Promise<SlotWarning[]> {
  const db = getDbClient(tx);
  const warnings: SlotWarning[] = [];

  if (
    slot.missionType === MissionType.CRACK &&
    slot.targetUrl &&
    slot.targetEmail
  ) {
    const duplicateCrack = await db.missionSlot.count({
      where: {
        id: { not: slot.id },
        missionType: MissionType.CRACK,
        isActive: true,
        targetUrl: slot.targetUrl,
        targetEmail: slot.targetEmail,
      },
    });

    if (duplicateCrack > 0) {
      warnings.push({
        code: 'DUPLICATE_CRACK_LAUNCHER',
        message:
          'Уже существует активный Crack-слот с таким URL и логином. Launch-эндпоинт вернёт непредсказуемый слот (findFirst).',
      });
    }
  }

  if (slot.missionType === MissionType.DECIPHER && slot.folderPath) {
    const duplicateDecipher = await db.missionSlot.count({
      where: {
        id: { not: slot.id },
        missionType: MissionType.DECIPHER,
        isActive: true,
        folderPath: slot.folderPath,
      },
    });

    if (duplicateDecipher > 0) {
      warnings.push({
        code: 'DUPLICATE_DECIPHER_FOLDER',
        message:
          'Уже существует активный Decipher-слот с таким путём к папке. Launch-эндпоинт вернёт непредсказуемый слот (findFirst).',
      });
    }
  }

  if (slot.missionType === MissionType.RDP && slot.correctIp) {
    const duplicateRdp = await db.missionSlot.count({
      where: {
        id: { not: slot.id },
        missionType: MissionType.RDP,
        isActive: true,
        correctIp: slot.correctIp,
      },
    });

    if (duplicateRdp > 0) {
      warnings.push({
        code: 'DUPLICATE_RDP_IP',
        message:
          'Уже существует активный RDP-слот с таким IP. Connect-эндпоинт вернёт непредсказуемый слот (findFirst).',
      });
    }
  }

  if (
    slot.missionType === MissionType.DECIPHER &&
    slot.unlocksRdpFolder &&
    slot.unlocksRdpSlotKey
  ) {
    const rdpSlot = await db.missionSlot.findFirst({
      where: {
        slotKey: slot.unlocksRdpSlotKey,
        missionType: MissionType.RDP,
        isActive: true,
      },
      select: {
        id: true,
        rdpFiles: {
          where: {
            folder: slot.unlocksRdpFolder,
            isLocked: true,
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!rdpSlot || rdpSlot.rdpFiles.length === 0) {
      warnings.push({
        code: 'DECIPHER_RDP_FOLDER_NOT_FOUND',
        message: `Папка «${slot.unlocksRdpFolder}» не найдена в RDP-слоте «${slot.unlocksRdpSlotKey}» или не помечена как запароленная. Разблокировка через этот пароль не сработает.`,
      });
    }
  }

  if (slot.missionType === MissionType.RDP && slot.rdpScenario === 1) {
    if (!slot.nextRdpSlotKey) {
      warnings.push({
        code: 'RDP_NEXT_SLOT_MISSING',
        message:
          'Для сценария 1 рекомендуется указать следующий RDP-слот в цепочке. Без него IP следующего шага не будет показан в логах.',
      });
    } else {
      const nextSlot = await db.missionSlot.findFirst({
        where: {
          slotKey: slot.nextRdpSlotKey,
          missionType: MissionType.RDP,
          isActive: true,
        },
        select: { id: true },
      });

      if (!nextSlot) {
        warnings.push({
          code: 'RDP_NEXT_SLOT_MISSING',
          message: `Следующий RDP-слот «${slot.nextRdpSlotKey}» не найден или неактивен.`,
        });
      }
    }
  }

  return warnings;
}
