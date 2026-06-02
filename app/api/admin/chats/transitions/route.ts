import { NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import {
  isPrismaForeignKeyError,
  normalizeConditionValue,
  serializeTransition,
  TRANSITION_SELECT,
  validateTransitionPayload,
} from '@/lib/admin/chatTransitionApi';
import { prisma } from '@/lib/prisma';
import { createTransitionSchema } from '@/lib/validations/admin-chats';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function validationErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: 'VALIDATION_ERROR', message: message ?? 'Неверные параметры запроса' },
    { status: 400 },
  );
}

function transitionErrorResponse(
  err: { code: string; message?: string },
): NextResponse {
  if (err.code === 'INVALID_TRIGGER_VALUE') {
    return NextResponse.json({ error: 'INVALID_TRIGGER_VALUE' }, { status: 400 });
  }

  if (err.code === 'INVALID_REFERENCE') {
    return NextResponse.json({ error: 'INVALID_REFERENCE' }, { status: 400 });
  }

  return validationErrorResponse(err.message);
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const transitions = await prisma.chatTransition.findMany({
    select: TRANSITION_SELECT,
    orderBy: [
      { fromMessage: { code: 'asc' } },
      { priority: 'desc' },
    ],
  });

  return NextResponse.json(transitions.map(serializeTransition));
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return validationErrorResponse();
  }

  const parsed = createTransitionSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const { fromMessageId, toMessageId, conditionType, priority } = parsed.data;
  const conditionValue = normalizeConditionValue(
    conditionType,
    parsed.data.conditionValue,
  );

  const payload = {
    fromMessageId,
    toMessageId,
    conditionType,
    conditionValue,
    priority,
  };

  const validationError = await validateTransitionPayload(payload);

  if (validationError) {
    return transitionErrorResponse(validationError);
  }

  try {
    const transition = await prisma.chatTransition.create({
      data: {
        fromMessageId,
        toMessageId,
        conditionType,
        conditionValue,
        priority,
      },
      select: TRANSITION_SELECT,
    });

    return NextResponse.json(serializeTransition(transition), { status: 201 });
  } catch (error) {
    if (isPrismaForeignKeyError(error)) {
      return NextResponse.json({ error: 'INVALID_REFERENCE' }, { status: 400 });
    }

    throw error;
  }
}
