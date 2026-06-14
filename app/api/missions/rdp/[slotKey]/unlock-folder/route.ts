import { NextRequest, NextResponse } from 'next/server';

import { RDP_UNLOCK_FOLDER_RATE_LIMIT } from '@/constants/gameConfig';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { unlockFolder } from '@/lib/rdp/service';
import { rdpUnlockFolderSchema } from '@/lib/validations/missions';

interface RouteParams {
  params: Promise<{ slotKey: string }>;
}

const RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(
  req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slotKey } = await params;

  const allowed = checkRateLimit(
    `rdp-unlock-folder:${session.user.id}:${slotKey}`,
    RDP_UNLOCK_FOLDER_RATE_LIMIT,
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

  const parsed = rdpUnlockFolderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const outcome = await unlockFolder(
      session.user.id,
      slotKey,
      parsed.data.folderName,
      parsed.data.password,
      parsed.data.expectedVersion,
    );

    switch (outcome.type) {
      case 'SUCCESS':
        return NextResponse.json({
          success: true,
          folderName: outcome.folderName,
          version: outcome.version,
        });
      case 'CONFLICT':
        return NextResponse.json(
          { error: 'CONFLICT', currentVersion: outcome.currentVersion },
          { status: 409 },
        );
      case 'INVALID_PASSWORD':
        return NextResponse.json({ error: 'INVALID_PASSWORD' }, { status: 400 });
      case 'FOLDER_NOT_LOCKED':
        return NextResponse.json({ error: 'FOLDER_NOT_LOCKED' }, { status: 400 });
      case 'FOLDER_NOT_FOUND':
        return NextResponse.json({ error: 'FOLDER_NOT_FOUND' }, { status: 404 });
      case 'PUZZLE_NOT_SOLVED':
        return NextResponse.json({ error: 'PUZZLE_NOT_SOLVED' }, { status: 400 });
      case 'SLOT_NOT_FOUND':
        return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[POST /api/missions/rdp/[slotKey]/unlock-folder]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
