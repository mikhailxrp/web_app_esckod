import { NextRequest, NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { handleSkip } from '@/lib/rdp/service';
import { rdpSkipSchema } from '@/lib/validations/missions';

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
    body = {};
  }

  const parsed = rdpSkipSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const outcome = await handleSkip(session.user.id, slotKey);

    switch (outcome.type) {
      case 'SUCCESS':
        return NextResponse.json({ success: true });
      case 'CANNOT_SKIP':
        return NextResponse.json({ error: 'CANNOT_SKIP' }, { status: 400 });
      case 'SKIP_NOT_ALLOWED_SCENARIO_1':
        return NextResponse.json(
          { error: 'SKIP_NOT_ALLOWED_SCENARIO_1' },
          { status: 400 },
        );
      case 'SLOT_NOT_FOUND':
        return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[POST /api/missions/rdp/[slotKey]/skip]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
