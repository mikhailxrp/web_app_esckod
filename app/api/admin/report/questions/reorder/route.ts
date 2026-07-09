import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { reorderQuestionsSchema } from '@/lib/validations/admin-report';

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

  const parsed = reorderQuestionsSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const items = parsed.data;
  const ids = items.map((item) => item.id);

  const existingQuestions = await prisma.finalReportQuestion.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });

  if (existingQuestions.length !== ids.length) {
    return notFoundResponse();
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < items.length; i++) {
        await tx.finalReportQuestion.update({
          where: { id: items[i].id },
          data: { orderIndex: -(i + 1) },
        });
      }

      for (const item of items) {
        await tx.finalReportQuestion.update({
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

  const questions = await prisma.finalReportQuestion.findMany({
    orderBy: { orderIndex: 'asc' },
  });

  return NextResponse.json(questions.map(serializeQuestion));
}
