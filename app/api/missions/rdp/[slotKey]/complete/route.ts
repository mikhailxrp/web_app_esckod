import { NextRequest, NextResponse } from 'next/server';

import { RDP_COMPLETE_RATE_LIMIT } from '@/constants/gameConfig';
import { requirePlayer } from '@/lib/auth-guards';
import { checkRateLimit } from '@/lib/rateLimit';
import { handleComplete } from '@/lib/rdp/service';
import { rdpCompleteSchema } from '@/lib/validations/missions';

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
    `rdp-complete:${session.user.id}:${slotKey}`,
    RDP_COMPLETE_RATE_LIMIT,
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

  const parsed = rdpCompleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const outcome = await handleComplete(
      session.user.id,
      slotKey,
      parsed.data.expectedVersion,
    );

    switch (outcome.type) {
      case 'SUCCESS':
        return NextResponse.json({ success: true, version: outcome.version });
      case 'CONFLICT':
        return NextResponse.json(
          { error: 'CONFLICT', currentVersion: outcome.currentVersion },
          { status: 409 },
        );
      case 'TRIGGER_NOT_ACTIVATED':
        return NextResponse.json({ error: 'TRIGGER_NOT_ACTIVATED' }, { status: 400 });
      case 'SLOT_NOT_FOUND':
        return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[POST /api/missions/rdp/[slotKey]/complete]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
