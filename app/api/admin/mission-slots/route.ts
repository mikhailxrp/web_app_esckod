import { NextRequest, NextResponse } from 'next/server';
import { type MissionSlot, Prisma } from '@prisma/client';
import { z } from 'zod';
import { getMissionSlotWarnings } from '@/lib/admin/missionSlotWarnings';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { createMissionSlotSchema } from '@/lib/validations/admin-mission-slots';

const querySchema = z.object({
  missionType: z.enum(['CRACK', 'DECIPHER', 'RDP']).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

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

function validationErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: 'VALIDATION_ERROR', message: message ?? 'Неверные параметры запроса' },
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const sp = request.nextUrl.searchParams;
  const parsedQuery = querySchema.safeParse({
    missionType: sp.get('missionType') ?? undefined,
    isActive: sp.get('isActive') ?? undefined,
  });

  if (!parsedQuery.success) {
    return validationErrorResponse();
  }

  const { missionType, isActive } = parsedQuery.data;

  try {
    const where: Prisma.MissionSlotWhereInput = {};

    if (missionType !== undefined) {
      where.missionType = missionType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const slots = await prisma.missionSlot.findMany({
      where,
      orderBy: { orderIndex: 'asc' },
      select: MISSION_SLOT_SELECT,
    });

    const result = await Promise.all(slots.map((slot) => attachCompletionsCount(slot)));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[mission-slots/route] GET error:', error);

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Не удалось загрузить список слотов' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return validationErrorResponse();
  }

  const parsed = createMissionSlotSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  try {
    const existing = await prisma.missionSlot.findUnique({
      where: { slotKey: parsed.data.slotKey },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: 'SLOT_KEY_EXISTS' }, { status: 400 });
    }

    const slot = await prisma.missionSlot.create({
      data: parsed.data,
    });

    const warnings = await getMissionSlotWarnings(slot);
    const { targetWord: _targetWord, ...publicSlot } = slot;

    return NextResponse.json(
      {
        slot: await attachCompletionsCount(publicSlot),
        warnings,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[mission-slots/route] POST error:', error);

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Не удалось создать слот' },
      { status: 500 },
    );
  }
}
