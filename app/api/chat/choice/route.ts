import { NextRequest, NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { advanceChatState, type AdvanceResult } from '@/lib/chat/advance';
import { applyTemplateToAdvanceResult } from '@/lib/chat/template';
import { prisma } from '@/lib/prisma';
import { choiceSchema } from '@/lib/validations/chat';

function mapAdvanceResult(result: AdvanceResult): NextResponse {
  switch (result.status) {
    case 'ok':
      return NextResponse.json({
        currentMessage: result.currentMessage,
        isWaiting: result.isWaiting,
        isFinished: result.isFinished,
        version: result.version,
      });
    case 'waiting':
      return NextResponse.json({
        currentMessage: result.currentMessage,
        isWaiting: true,
        isFinished: false,
        version: result.version,
      });
    case 'choice_required':
      return NextResponse.json({ error: 'CHOICE_REQUIRED' }, { status: 400 });
    case 'invalid_choice':
      return NextResponse.json({ error: 'INVALID_CHOICE' }, { status: 400 });
    case 'conflict':
      return NextResponse.json(
        { error: 'CONFLICT', currentVersion: result.currentVersion },
        { status: 409 },
      );
    case 'no_start':
      return NextResponse.json({ error: 'NO_START_MESSAGE' }, { status: 500 });
    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  const parsed = choiceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const result = await advanceChatState(session.user.id, parsed.data.chatType, {
      choiceValue: parsed.data.value,
      expectedVersion: parsed.data.expectedVersion,
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { email: true },
    });

    return mapAdvanceResult(applyTemplateToAdvanceResult(result, { email: user.email }));
  } catch (error) {
    console.error('[POST /api/chat/choice]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
