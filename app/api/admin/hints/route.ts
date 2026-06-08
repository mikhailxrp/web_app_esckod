import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { createHintSchema } from '@/lib/validations/admin-hints';

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

const HINT_SELECT = {
  id: true,
  orderIndex: true,
  text: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

function serializeHint(hint: {
  id: string;
  orderIndex: number;
  text: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...hint,
    createdAt: hint.createdAt.toISOString(),
    updatedAt: hint.updatedAt.toISOString(),
  };
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const hints = await prisma.detectiveHint.findMany({
    orderBy: { orderIndex: 'asc' },
    select: HINT_SELECT,
  });

  return NextResponse.json(hints.map(serializeHint));
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

  const parsed = createHintSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const { text, orderIndex, isActive } = parsed.data;

  try {
    const hint = await prisma.detectiveHint.create({
      data: {
        text,
        orderIndex,
        isActive,
      },
      select: HINT_SELECT,
    });

    return NextResponse.json(serializeHint(hint), { status: 201 });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ error: 'INDEX_TAKEN' }, { status: 400 });
    }

    throw error;
  }
}
