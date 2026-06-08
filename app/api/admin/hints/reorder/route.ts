import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { reorderSchema } from '@/lib/validations/admin-hints';

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

  const parsed = reorderSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const items = parsed.data;
  const ids = items.map((item) => item.id);

  const existingHints = await prisma.detectiveHint.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });

  if (existingHints.length !== ids.length) {
    return notFoundResponse();
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < items.length; i++) {
        await tx.detectiveHint.update({
          where: { id: items[i].id },
          data: { orderIndex: -(i + 1) },
        });
      }

      for (const item of items) {
        await tx.detectiveHint.update({
          where: { id: item.id },
          data: { orderIndex: item.newOrderIndex },
        });
      }
    });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return notFoundResponse();
    }

    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ error: 'INDEX_TAKEN' }, { status: 400 });
    }

    throw error;
  }

  const hints = await prisma.detectiveHint.findMany({
    orderBy: { orderIndex: 'asc' },
    select: HINT_SELECT,
  });

  return NextResponse.json(hints.map(serializeHint));
}
