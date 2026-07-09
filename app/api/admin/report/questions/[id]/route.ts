import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { updateQuestionSchema } from '@/lib/validations/admin-report';

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

function serializeQuestion(question: {
  id: string;
  orderIndex: number;
  questionText: string;
  options: unknown;
  correctOption: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: question.id,
    orderIndex: question.orderIndex,
    questionText: question.questionText,
    options: question.options as string[],
    correctOption: question.correctOption,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
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

  const parsed = updateQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const existing = await prisma.finalReportQuestion.findUnique({
    where: { id },
    select: { id: true, options: true, correctOption: true, questionText: true },
  });

  if (!existing) {
    return notFoundResponse();
  }

  const merged = {
    questionText: parsed.data.questionText ?? existing.questionText,
    options: parsed.data.options ?? (existing.options as string[]),
    correctOption: parsed.data.correctOption ?? existing.correctOption,
  };

  const fullValidation = updateQuestionSchema.safeParse(merged);

  if (!fullValidation.success) {
    return validationErrorResponse(fullValidation.error.errors[0]?.message);
  }

  const updateData: Prisma.FinalReportQuestionUpdateInput = {};

  if (parsed.data.questionText !== undefined) {
    updateData.questionText = parsed.data.questionText;
  }

  if (parsed.data.options !== undefined) {
    updateData.options = parsed.data.options;
  }

  if (parsed.data.correctOption !== undefined) {
    updateData.correctOption = parsed.data.correctOption;
  }

  try {
    const question = await prisma.finalReportQuestion.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(serializeQuestion(question));
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return notFoundResponse();
    }

    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ error: 'INDEX_TAKEN' }, { status: 400 });
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

  try {
    await prisma.finalReportQuestion.delete({ where: { id } });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return notFoundResponse();
    }

    throw error;
  }

  return NextResponse.json({ success: true });
}
