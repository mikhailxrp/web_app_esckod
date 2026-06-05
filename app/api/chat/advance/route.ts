import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { advanceChatState, type AdvanceResult } from '@/lib/chat/advance';
import { applyTemplateToAdvanceResult } from '@/lib/chat/template';
import { prisma } from '@/lib/prisma';
import { advanceSchema } from '@/lib/validations/chat';

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
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  const parsed = advanceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const result = await advanceChatState(session.user.id, parsed.data.chatType, {
      expectedVersion: parsed.data.expectedVersion,
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { email: true },
    });

    return mapAdvanceResult(applyTemplateToAdvanceResult(result, { email: user.email }));
  } catch (error) {
    console.error('[POST /api/chat/advance]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
