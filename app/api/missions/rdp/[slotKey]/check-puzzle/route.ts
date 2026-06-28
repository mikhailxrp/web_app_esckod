import { NextRequest, NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { checkPuzzle } from '@/lib/rdp/service';
import { rdpCheckPuzzleSchema } from '@/lib/validations/missions';

interface RouteParams {
  params: Promise<{ slotKey: string }>;
}

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

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  const parsed = rdpCheckPuzzleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const outcome = await checkPuzzle(
      session.user.id,
      slotKey,
      parsed.data.expectedVersion,
    );

    switch (outcome.type) {
      case 'SUCCESS':
        return NextResponse.json({
          isSolved: outcome.isSolved,
          version: outcome.version,
        });
      case 'CONFLICT':
        return NextResponse.json(
          { error: 'CONFLICT', currentVersion: outcome.currentVersion },
          { status: 409 },
        );
      case 'NO_PROGRESS':
        return NextResponse.json({ error: 'NO_PROGRESS' }, { status: 400 });
      case 'SLOT_NOT_FOUND':
        return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[POST /api/missions/rdp/[slotKey]/check-puzzle]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
