import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { parseChoices, updateScriptSchema } from '@/lib/validations/admin-chats';

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

function isPrismaNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}

const SCRIPT_SELECT = {
  id: true,
  chatType: true,
  code: true,
  text: true,
  audioUrl: true,
  hasChoices: true,
  choices: true,
  isStart: true,
  isEnd: true,
  createdAt: true,
  updatedAt: true,
} as const;

function serializeScript(script: {
  id: string;
  chatType: string;
  code: string;
  text: string;
  audioUrl: string | null;
  hasChoices: boolean;
  choices: Prisma.JsonValue;
  isStart: boolean;
  isEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...script,
    choices: parseChoices(script.choices),
    createdAt: script.createdAt.toISOString(),
    updatedAt: script.updatedAt.toISOString(),
  };
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await params;

  const script = await prisma.chatScript.findUnique({
    where: { id },
    select: SCRIPT_SELECT,
  });

  if (!script) {
    return notFoundResponse();
  }

  return NextResponse.json(serializeScript(script));
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return validationErrorResponse();
  }

  const rawBody = body as Record<string, unknown>;

  if ('code' in rawBody || 'chatType' in rawBody) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Изменение code и chatType запрещено' },
      { status: 400 },
    );
  }

  const parsed = updateScriptSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const { text, hasChoices, isStart, isEnd, choices } = parsed.data;

  const updateData: Prisma.ChatScriptUpdateInput = {};

  if (text !== undefined) updateData.text = text;
  if (hasChoices !== undefined) updateData.hasChoices = hasChoices;
  if (isStart !== undefined) updateData.isStart = isStart;
  if (isEnd !== undefined) updateData.isEnd = isEnd;

  if (hasChoices === false) {
    updateData.choices = Prisma.JsonNull;
  } else if (choices !== undefined) {
    updateData.choices = choices as Prisma.InputJsonValue;
  }

  try {
    const script = await prisma.chatScript.update({
      where: { id },
      data: updateData,
      select: SCRIPT_SELECT,
    });

    return NextResponse.json(serializeScript(script));
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return notFoundResponse();
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

  const existing = await prisma.chatScript.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return notFoundResponse();
  }

  await prisma.chatScript.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
