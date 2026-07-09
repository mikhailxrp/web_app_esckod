import { NextRequest, NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { findActiveCrackSlot } from '@/lib/crack/launch';
import { writeLog } from '@/lib/operationLog';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rateLimit';
import { crackLaunchSchema } from '@/lib/validations/missions';

const LAUNCH_RATE_LIMIT_MAX = 30;
const LAUNCH_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

  const allowed = checkRateLimit(
    `crack-launch:${session.user.id}`,
    LAUNCH_RATE_LIMIT_MAX,
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

  const parsed = crackLaunchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  const { targetUrl, targetEmail } = parsed.data;

  try {
    const match = await findActiveCrackSlot(targetUrl, targetEmail);

    if (!match) {
      await writeLog({
        userId: session.user.id,
        templateKey: 'crack_launch_failed',
        params: { targetUrl, targetEmail },
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
    console.error('[POST /api/missions/crack/launch]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
