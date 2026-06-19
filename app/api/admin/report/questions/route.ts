import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { createQuestionSchema } from '@/lib/validations/admin-report';

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

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const questions = await prisma.finalReportQuestion.findMany({
    orderBy: { orderIndex: 'asc' },
  });

  return NextResponse.json(questions.map(serializeQuestion));
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

  const parsed = createQuestionSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const { questionText, options, correctOption, orderIndex } = parsed.data;

  try {
    const question = await prisma.finalReportQuestion.create({
      data: {
        questionText,
        options,
        correctOption,
        orderIndex,
      },
    });

    return NextResponse.json(serializeQuestion(question), { status: 201 });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ error: 'INDEX_TAKEN' }, { status: 400 });
    }

    throw error;
  }
}
