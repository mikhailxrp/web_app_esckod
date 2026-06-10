import { NextRequest, NextResponse } from 'next/server';

import { DECIPHER_ATTEMPT_RATE_LIMIT } from '@/constants/gameConfig';
import { auth } from '@/lib/auth';
import { applyDecipherAttempt } from '@/lib/decipher/service';
import { checkRateLimit } from '@/lib/rateLimit';
import { decipherAttemptSchema } from '@/lib/validations/missions';

const ATTEMPT_RATE_LIMIT_WINDOW_MS = 60_000;

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

  const allowed = checkRateLimit(
    `decipher-attempt:${session.user.id}:${slotKey}`,
    DECIPHER_ATTEMPT_RATE_LIMIT,
    ATTEMPT_RATE_LIMIT_WINDOW_MS,
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

  const parsed = decipherAttemptSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const outcome = await applyDecipherAttempt(
      session.user.id,
      slotKey,
      parsed.data.decryptedWord,
    );

    switch (outcome.type) {
      case 'CORRECT':
        return NextResponse.json({ isCorrect: true, canSkip: false });
      case 'INCORRECT':
        return NextResponse.json({
          isCorrect: false,
          canSkip: outcome.canSkip,
        });
      case 'SLOT_NOT_FOUND':
        return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 });
      case 'BAD_SLOT_CONTENT':
        return NextResponse.json(
          {
            error:
              outcome.reason === 'INVALID_CIPHER_TYPE'
                ? 'INVALID_CIPHER_TYPE'
                : 'BAD_SLOT_CONTENT',
          },
          { status: 500 },
        );
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  } catch (error) {
    console.error('[POST /api/missions/decipher/[slotKey]/attempt]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
