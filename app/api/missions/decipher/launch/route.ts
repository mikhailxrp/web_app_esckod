import { NextRequest, NextResponse } from 'next/server';

import { DECIPHER_LAUNCH_RATE_LIMIT } from '@/constants/gameConfig';
import { requirePlayer } from '@/lib/auth-guards';
import { findActiveDecipherSlot } from '@/lib/decipher/launch';
import { writeLog } from '@/lib/operationLog';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rateLimit';
import { decipherLaunchSchema } from '@/lib/validations/missions';

const LAUNCH_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

  const allowed = checkRateLimit(
    `decipher-launch:${session.user.id}`,
    DECIPHER_LAUNCH_RATE_LIMIT,
    LAUNCH_RATE_LIMIT_WINDOW_MS,
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

  const parsed = decipherLaunchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  const { folderPath, cipherKey } = parsed.data;

  try {
    const match = await findActiveDecipherSlot(folderPath, cipherKey);

    if (!match) {
      await writeLog({
        userId: session.user.id,
        templateKey: 'decipher_launch_failed',
        params: { folderPath, cipherKey },
        type: 'ERROR',
      });

      return NextResponse.json({ error: 'INVALID_LAUNCH_DATA' }, { status: 400 });
    }

    const progress = await prisma.missionProgress.findUnique({
      where: { userId_slotId: { userId: session.user.id, slotId: match.slotId } },
      select: { completed: true },
    });

    return NextResponse.json({
      slotKey: match.slotKey,
      isCompleted: progress?.completed ?? false,
    });
  } catch (error) {
    console.error('[POST /api/missions/decipher/launch]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
