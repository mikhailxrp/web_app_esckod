import { NextRequest, NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import {
  isPrismaForeignKeyError,
  isPrismaNotFoundError,
  normalizeConditionValue,
  serializeTransition,
  TRANSITION_SELECT,
  validateTransitionPayload,
} from '@/lib/admin/chatTransitionApi';
import { prisma } from '@/lib/prisma';
import { updateTransitionSchema } from '@/lib/validations/admin-chats';
import type { ConditionType } from '@/types/admin-chats';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function notFoundResponse(): NextResponse {
  return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await params;

  const existing = await prisma.chatTransition.findUnique({
    where: { id },
    select: {
      fromMessageId: true,
      toMessageId: true,
      conditionType: true,
      conditionValue: true,
      priority: true,
    },
  });

  if (!existing) {
    return notFoundResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return validationErrorResponse();
  }

  const parsed = updateTransitionSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const effectiveType = (parsed.data.conditionType ??
    existing.conditionType) as ConditionType;

  let effectiveValue: string | null | undefined;

  if (parsed.data.conditionValue !== undefined) {
    effectiveValue = parsed.data.conditionValue;
  } else if (parsed.data.conditionType !== undefined && parsed.data.conditionType !== existing.conditionType) {
    effectiveValue = effectiveType === 'ALWAYS' ? null : existing.conditionValue;
  } else {
    effectiveValue = existing.conditionValue;
  }

  const conditionValue = normalizeConditionValue(effectiveType, effectiveValue);

  const payload = {
    fromMessageId: parsed.data.fromMessageId ?? existing.fromMessageId,
    toMessageId: parsed.data.toMessageId ?? existing.toMessageId,
    conditionType: effectiveType,
    conditionValue,
    priority: parsed.data.priority ?? existing.priority,
  };

  const validationError = await validateTransitionPayload(payload);

  if (validationError) {
    return transitionErrorResponse(validationError);
  }

  try {
    const transition = await prisma.chatTransition.update({
      where: { id },
      data: {
        fromMessageId: payload.fromMessageId,
        toMessageId: payload.toMessageId,
        conditionType: payload.conditionType,
        conditionValue: payload.conditionValue,
        priority: payload.priority,
      },
      select: TRANSITION_SELECT,
    });

    return NextResponse.json(serializeTransition(transition));
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return notFoundResponse();
    }

    if (isPrismaForeignKeyError(error)) {
      return NextResponse.json({ error: 'INVALID_REFERENCE' }, { status: 400 });
    }

    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await params;

  const existing = await prisma.chatTransition.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return notFoundResponse();
  }

  await prisma.chatTransition.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
