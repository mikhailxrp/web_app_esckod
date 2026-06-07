import { NextRequest, NextResponse } from 'next/server';
import { type MissionSlot, MissionType } from '@prisma/client';
import { writeAuditLog } from '@/lib/admin/auditLog';
import { getMissionSlotWarnings } from '@/lib/admin/missionSlotWarnings';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import {
  updateCrackMissionSlotSchema,
  updateDecipherMissionSlotSchema,
  updateRdpMissionSlotSchema,
} from '@/lib/validations/admin-mission-slots';

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

type PublicMissionSlot = Omit<MissionSlot, 'targetWord'>;

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function notFoundResponse(): NextResponse {
  return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
}

function validationErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: 'VALIDATION_ERROR', message: message ?? 'Неверные параметры запроса' },
    { status: 400 },
  );
}

function lastActiveSlotOfTypeResponse(missionType: MissionType): NextResponse {
  return NextResponse.json(
    {
      error: 'LAST_ACTIVE_SLOT_OF_TYPE',
      missionType,
      message: `Нельзя деактивировать последний активный слот типа ${missionType}. Сначала активируйте другой слот этого типа.`,
    },
    { status: 400 },
  );
}

function serializeMissionSlot(slot: PublicMissionSlot) {
  return {
    ...slot,
    createdAt: slot.createdAt.toISOString(),
    updatedAt: slot.updatedAt.toISOString(),
  };
}

async function attachCompletionsCount(
  slot: PublicMissionSlot,
): Promise<ReturnType<typeof serializeMissionSlot> & { completionsCount: number }> {
  const completionsCount = await prisma.missionProgress.count({
    where: {
      slotId: slot.id,
      completed: true,
    },
  });

  return {
    ...serializeMissionSlot(slot),
    completionsCount,
  };
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await params;

  try {
    const slot = await prisma.missionSlot.findUnique({
      where: { id },
      select: MISSION_SLOT_SELECT,
    });

    if (!slot) {
      return notFoundResponse();
    }

    let targetWord: string | null = null;
    if (slot.missionType === MissionType.CRACK) {
      const withWord = await prisma.missionSlot.findUnique({
        where: { id },
        select: { targetWord: true },
      });
      targetWord = withWord?.targetWord ?? null;
    }

    const base = await attachCompletionsCount(slot);
    return NextResponse.json({ ...base, targetWord });
  } catch (error) {
    console.error('[mission-slots/[id]/route] GET error:', error);

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Не удалось загрузить слот' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return validationErrorResponse();
  }

  try {
    const existing = await prisma.missionSlot.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFoundResponse();
    }

    const rawBody = body as Record<string, unknown>;

    if ('slotKey' in rawBody || 'missionType' in rawBody) {
      return NextResponse.json({ error: 'IMMUTABLE_FIELD' }, { status: 400 });
    }

    const updateSchema =
      existing.missionType === MissionType.CRACK
        ? updateCrackMissionSlotSchema
        : existing.missionType === MissionType.DECIPHER
          ? updateDecipherMissionSlotSchema
          : updateRdpMissionSlotSchema;

    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.errors[0]?.message);
    }

    if (parsed.data.isActive === false) {
      const otherActive = await prisma.missionSlot.count({
        where: {
          missionType: existing.missionType,
          isActive: true,
          id: { not: existing.id },
        },
      });

      if (otherActive === 0) {
        return lastActiveSlotOfTypeResponse(existing.missionType);
      }
    }

    const slot = await prisma.missionSlot.update({
      where: { id },
      data: parsed.data,
    });

    const warnings = await getMissionSlotWarnings(slot);
    const { targetWord: _targetWord, ...publicSlot } = slot;

    return NextResponse.json({
      slot: await attachCompletionsCount(publicSlot),
      warnings,
    });
  } catch (error) {
    console.error('[mission-slots/[id]/route] PATCH error:', error);

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Не удалось обновить слот' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await params;

  try {
    const slot = await prisma.missionSlot.findUnique({
      where: { id },
      select: { id: true, slotKey: true, displayName: true, missionType: true, isActive: true },
    });

    if (!slot) {
      return notFoundResponse();
    }

    const activeSessionsCount = await prisma.crackSession.count({
      where: { slotId: id },
    });

    if (activeSessionsCount > 0) {
      return NextResponse.json(
        {
          error: 'SLOT_HAS_ACTIVE_SESSIONS',
          message:
            'Нельзя удалить слот с активными сессиями Crack. Сначала дождитесь завершения игроков или деактивируйте слот.',
        },
        { status: 400 },
      );
    }

    // Проверяем только когда слот активен — удаление неактивного слота
    // не сокращает количество активных слотов типа.
    if (slot.isActive) {
      const otherActive = await prisma.missionSlot.count({
        where: {
          missionType: slot.missionType,
          isActive: true,
          id: { not: id },
        },
      });

      if (otherActive === 0) {
        return lastActiveSlotOfTypeResponse(slot.missionType);
      }
    }

    await prisma.missionSlot.delete({ where: { id } });

    await writeAuditLog('mission_slot_deleted', {
      adminId: session.user.id,
      message: `Слот "${slot.displayName}" (${slot.slotKey}) удалён`,
      metadata: { slotKey: slot.slotKey, displayName: slot.displayName },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[mission-slots/[id]/route] DELETE error:', error);

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Не удалось удалить слот' },
      { status: 500 },
    );
  }
}
