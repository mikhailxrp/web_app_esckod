import { NextRequest, NextResponse } from 'next/server';

import { RDP_FILE_VIEWED_RATE_LIMIT } from '@/constants/gameConfig';
import { requirePlayer } from '@/lib/auth-guards';
import { checkRateLimit } from '@/lib/rateLimit';
import { handleFileViewed } from '@/lib/rdp/service';
import { rdpFileViewedSchema } from '@/lib/validations/missions';

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
    `rdp-file-viewed:${session.user.id}:${slotKey}`,
    RDP_FILE_VIEWED_RATE_LIMIT,
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

  const parsed = rdpFileViewedSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const outcome = await handleFileViewed(
      session.user.id,
      slotKey,
      parsed.data.fileId,
      parsed.data.expectedVersion,
    );

    switch (outcome.type) {
      case 'SUCCESS':
        return NextResponse.json({
          triggered: outcome.triggered,
          ...(outcome.alreadyTriggered !== undefined && { alreadyTriggered: outcome.alreadyTriggered }),
          ...(outcome.chatAdvanced !== undefined && { chatAdvanced: outcome.chatAdvanced }),
          ...(outcome.scenarioFinal !== undefined && { scenarioFinal: outcome.scenarioFinal }),
          version: outcome.version,
          ...(outcome.nextIp !== undefined && { nextIp: outcome.nextIp }),
        });
      case 'CONFLICT':
        return NextResponse.json(
          { error: 'CONFLICT', currentVersion: outcome.currentVersion },
          { status: 409 },
        );
      case 'PUZZLE_NOT_SOLVED':
        return NextResponse.json({ error: 'PUZZLE_NOT_SOLVED' }, { status: 400 });
      case 'FILE_NOT_FOUND_IN_SLOT':
        return NextResponse.json({ error: 'FILE_NOT_FOUND_IN_SLOT' }, { status: 404 });
      case 'FOLDER_NOT_UNLOCKED':
        return NextResponse.json({ error: 'FOLDER_NOT_UNLOCKED' }, { status: 400 });
      case 'SLOT_NOT_FOUND':
        return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[POST /api/missions/rdp/[slotKey]/file-viewed]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
