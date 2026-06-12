import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { rotateTile } from '@/lib/rdp/service';
import { rdpRotateTileSchema } from '@/lib/validations/missions';

interface RouteParams {
  params: Promise<{ slotKey: string }>;
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slotKey } = await params;

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  const parsed = rdpRotateTileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const outcome = await rotateTile(
      session.user.id,
      slotKey,
      parsed.data.tileId,
      parsed.data.expectedVersion,
    );

    switch (outcome.type) {
      case 'SUCCESS':
        return NextResponse.json({
          puzzleField: outcome.puzzleField,
          version: outcome.version,
        });
      case 'CONFLICT':
        return NextResponse.json(
          { error: 'CONFLICT', currentVersion: outcome.currentVersion },
          { status: 409 },
        );
      case 'TILE_NOT_FOUND':
        return NextResponse.json({ error: 'TILE_NOT_FOUND' }, { status: 400 });
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
    console.error('[POST /api/missions/rdp/[slotKey]/rotate-tile]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
