import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { parseChoices } from '@/lib/validations/admin-chats';
import {
  createScriptSchema,
  listScriptsQuerySchema,
} from '@/lib/validations/admin-chats';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function validationErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: 'VALIDATION_ERROR', message: message ?? 'Неверные параметры запроса' },
    { status: 400 },
  );
}

function isPrismaUniqueError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

const SCRIPT_SELECT = {
  id: true,
  chatType: true,
  author: true,
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
  author: string;
  code: string;
  text: string | null;
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const sp = request.nextUrl.searchParams;
  const parsedQuery = listScriptsQuerySchema.safeParse({
    chatType: sp.get('chatType') ?? undefined,
  });

  if (!parsedQuery.success) {
    return validationErrorResponse();
  }

  const { chatType } = parsedQuery.data;

  const scripts = await prisma.chatScript.findMany({
    where: chatType ? { chatType } : undefined,
    orderBy: [{ chatType: 'asc' }, { code: 'asc' }],
    select: SCRIPT_SELECT,
  });

  return NextResponse.json(scripts.map(serializeScript));
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

  const parsed = createScriptSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const { chatType, author, code, text, hasChoices, isStart, isEnd, choices } = parsed.data;
  const normalizedChoices = hasChoices && choices && choices.length > 0
    ? (choices as Prisma.InputJsonValue)
    : Prisma.JsonNull;

  try {
    const script = await prisma.chatScript.create({
      data: {
        chatType,
        author,
        code,
        text: text?.trim() || null,
        hasChoices,
        isStart,
        isEnd,
        choices: normalizedChoices,
      },
      select: SCRIPT_SELECT,
    });

    return NextResponse.json(serializeScript(script), { status: 201 });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ error: 'CODE_EXISTS' }, { status: 400 });
    }

    throw error;
  }
}
