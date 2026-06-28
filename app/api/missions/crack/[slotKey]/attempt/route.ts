import { NextRequest, NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { applyAttempt } from '@/lib/crack/service';
import { crackAttemptSchema } from '@/lib/validations/missions';

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

  const parsed = crackAttemptSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const outcome = await applyAttempt(
      session.user.id,
      slotKey,
      parsed.data.word,
      parsed.data.expectedVersion,
    );

    switch (outcome.status) {
      case 'ok':
        return NextResponse.json(outcome.result);
      case 'not_found':
        return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
      case 'no_session':
        return NextResponse.json({ error: 'NO_ACTIVE_SESSION' }, { status: 400 });
      case 'word_not_in_field':
        return NextResponse.json({ error: 'WORD_NOT_IN_FIELD' }, { status: 400 });
      case 'conflict':
        return NextResponse.json(
          { error: 'CONFLICT', currentVersion: outcome.currentVersion },
          { status: 409 },
        );
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[POST /api/missions/crack/[slotKey]/attempt]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
