import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { writeAuditLog } from '@/lib/admin/auditLog';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { updateHintSchema } from '@/lib/validations/admin-hints';

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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return validationErrorResponse();
  }

  const rawBody = body as Record<string, unknown>;

  if ('orderIndex' in rawBody) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Изменение orderIndex через PATCH запрещено' },
      { status: 400 },
    );
  }

  const parsed = updateHintSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const { text, isActive } = parsed.data;

  const updateData: Prisma.DetectiveHintUpdateInput = {};

  if (text !== undefined) updateData.text = text;
  if (isActive !== undefined) updateData.isActive = isActive;

  try {
    const hint = await prisma.detectiveHint.update({
      where: { id },
      data: updateData,
      select: HINT_SELECT,
    });

    return NextResponse.json(serializeHint(hint));
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

  let existing: { id: string; orderIndex: number } | null = null;

  try {
    existing = await prisma.$transaction(async (tx) => {
      const hint = await tx.detectiveHint.findUnique({
        where: { id },
        select: { id: true, orderIndex: true },
      });

      if (!hint) return null;

      await tx.detectiveHint.delete({ where: { id } });

      return hint;
    });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return notFoundResponse();
    }

    throw error;
  }

  if (!existing) {
    return notFoundResponse();
  }

  await writeAuditLog('hint_deleted', {
    adminId: session.user.id,
    message: `Подсказка №${existing.orderIndex} удалена`,
    metadata: { hintId: existing.id, orderIndex: existing.orderIndex },
  });

  return NextResponse.json({ success: true });
}
