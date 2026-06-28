import { NextRequest, NextResponse } from 'next/server';

import { RDP_CONNECT_RATE_LIMIT } from '@/constants/gameConfig';
import { requirePlayer } from '@/lib/auth-guards';
import { handleConnect } from '@/lib/rdp/service';
import { checkRateLimit } from '@/lib/rateLimit';
import { rdpLaunchSchema } from '@/lib/validations/missions';

const RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

  const allowed = checkRateLimit(
    `rdp-connect:${session.user.id}`,
    RDP_CONNECT_RATE_LIMIT,
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

  const parsed = rdpLaunchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const outcome = await handleConnect(session.user.id, parsed.data.ip);

    switch (outcome.type) {
      case 'SUCCESS':
        return NextResponse.json({
          slotKey: outcome.slotKey,
          displayName: outcome.displayName,
          rdpScenario: outcome.rdpScenario,
          isCompleted: outcome.isCompleted,
          logSubjectName: outcome.logSubjectName,
          hintText: outcome.hintText,
        });
      case 'INVALID_IP':
        return NextResponse.json({ error: 'INVALID_IP' }, { status: 400 });
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[POST /api/missions/rdp/connect]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
