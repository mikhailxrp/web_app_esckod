import { LogType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { RDP_COPY_FOLDER_PATH_RATE_LIMIT } from '@/constants/gameConfig';
import { requirePlayer } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rateLimit';
import { writeLog } from '@/lib/operationLog';
import { rdpCopyFolderPathSchema } from '@/lib/validations/missions';

interface RouteParams {
  params: Promise<{ slotKey: string }>;
}

const RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(
  req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;
  const { slotKey } = await params;

  const allowed = checkRateLimit(
    `rdp-copy-folder-path:${session.user.id}:${slotKey}`,
    RDP_COPY_FOLDER_PATH_RATE_LIMIT,
    RATE_LIMIT_WINDOW_MS,
  );

  if (!allowed) {
    return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  const parsed = rdpCopyFolderPathSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  const { folderName } = parsed.data;

  try {
    const slot = await prisma.missionSlot.findUnique({
      where: { slotKey },
      select: { id: true, missionType: true, isActive: true, logSubjectName: true },
    });

    if (!slot || !slot.isActive || slot.missionType !== 'RDP') {
      return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
    }

    const decipherSlot = await prisma.missionSlot.findFirst({
      where: {
        unlocksRdpFolder: folderName,
        unlocksRdpSlotKey: slotKey,
        missionType: 'DECIPHER',
        isActive: true,
      },
      select: { folderPath: true },
    });

    await writeLog({
      userId: session.user.id,
      templateKey: 'rdp_folder_path_copied',
      params: {
        folderPath: decipherSlot?.folderPath ?? folderName,
        logSubjectName: slot.logSubjectName ?? '—',
      },
      type: LogType.SUCCESS,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/missions/rdp/[slotKey]/copy-folder-path]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
