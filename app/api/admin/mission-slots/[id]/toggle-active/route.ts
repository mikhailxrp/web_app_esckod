import { NextRequest, NextResponse } from 'next/server';
import type { MissionSlot } from '@prisma/client';
import { writeAuditLog } from '@/lib/admin/auditLog';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { toggleActiveMissionSlotSchema } from '@/lib/validations/admin-mission-slots';

const MISSION_SLOT_SELECT = {
  id: true,
  slotKey: true,
  missionType: true,
  orderIndex: true,
  isActive: true,
  displayName: true,
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
  logSubjectName: true,
  nextRdpSlotKey: true,
  timerSeconds: true,
  rdpPuzzleGridSize: true,
  hintText: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PublicMissionSlot = MissionSlot;

function serializeMissionSlot(slot: PublicMissionSlot) {
  return {
    ...slot,
    createdAt: slot.createdAt.toISOString(),
    updatedAt: slot.updatedAt.toISOString(),
  };
}

async function attachCompletionsCount(slot: PublicMissionSlot) {
  const completionsCount = await prisma.missionProgress.count({
    where: { slotId: slot.id, completed: true },
  });

  return { ...serializeMissionSlot(slot), completionsCount };
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Неверные параметры запроса' },
      { status: 400 },
    );
  }

  const parsed = toggleActiveMissionSlotSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message },
      { status: 400 },
    );
  }

  try {
    const slot = await prisma.missionSlot.findUnique({
      where: { id },
    });

    if (!slot) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    // Запрет деактивации последнего активного слота в типе.
    // Проверяем только когда слот сейчас активен — деактивация уже-неактивного
    // слота не меняет количество активных слотов типа.
    if (parsed.data.isActive === false && slot.isActive === true) {
      const otherActive = await prisma.missionSlot.count({
        where: {
          missionType: slot.missionType,
          isActive: true,
          id: { not: id },
        },
      });

      if (otherActive === 0) {
        return NextResponse.json(
          {
            error: 'LAST_ACTIVE_SLOT_OF_TYPE',
            missionType: slot.missionType,
            message: `Нельзя деактивировать последний активный слот типа ${slot.missionType}. Сначала активируйте другой слот этого типа.`,
          },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.missionSlot.update({
      where: { id },
      data: { isActive: parsed.data.isActive },
      select: MISSION_SLOT_SELECT,
    });

    // Аудит пишется только при реактивации (false → true).
    // Выключение — рутинное действие, в аудит не записывается.
    if (parsed.data.isActive === true && slot.isActive === false) {
      await writeAuditLog('mission_slot_reactivated', {
        adminId: session.user.id,
        message: `Слот "${slot.displayName}" (${slot.slotKey}) реактивирован`,
        metadata: { slotKey: slot.slotKey, displayName: slot.displayName },
      });
    }

    return NextResponse.json({
      slot: await attachCompletionsCount(updated),
    });
  } catch (error) {
    console.error('[mission-slots/[id]/toggle-active/route] PATCH error:', error);

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Не удалось изменить активность слота' },
      { status: 500 },
    );
  }
}
