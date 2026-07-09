import { NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { updateHistorySchema } from '@/lib/validations/admin-report';
import { isFinalChoiceQuestion } from '@/lib/final-report/isFinalChoiceQuestion';
import type { QuestionListItem, ContentItem, HistoryData } from '@/types/admin-report';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function validationErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: 'VALIDATION_ERROR', message: message ?? 'Неверные параметры запроса' },
    { status: 400 },
  );
}

function serializeQuestion(q: {
  id: string;
  orderIndex: number;
  questionText: string;
  options: unknown;
  correctOption: number;
  createdAt: Date;
  updatedAt: Date;
}): QuestionListItem {
  return {
    id: q.id,
    orderIndex: q.orderIndex,
    questionText: q.questionText,
    options: q.options as string[],
    correctOption: q.correctOption,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

function serializeContent(c: {
  id: string;
  finalChoiceValue: string;
  title: string;
  bodyText: string;
  createdAt: Date;
  updatedAt: Date;
}): ContentItem {
  return {
    id: c.id,
    finalChoiceValue: c.finalChoiceValue,
    title: c.title,
    bodyText: c.bodyText,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const [settings, questions, contents] = await Promise.all([
    prisma.appSettings.findFirst({ select: { finalReportQuestionId: true } }),
    prisma.finalReportQuestion.findMany({ orderBy: { orderIndex: 'asc' } }),
    prisma.finalReportContent.findMany({ orderBy: { finalChoiceValue: 'asc' } }),
  ]);

  const data: HistoryData = {
    finalReportQuestionId: settings?.finalReportQuestionId ?? null,
    questions: questions.map(serializeQuestion),
    contents: contents.map(serializeContent),
  };

  return NextResponse.json(data);
}

export async function PUT(request: Request): Promise<NextResponse> {
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

  const parsed = updateHistorySchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const { finalReportQuestionId, contents } = parsed.data;

  if (finalReportQuestionId !== null) {
    const question = await prisma.finalReportQuestion.findUnique({
      where: { id: finalReportQuestionId },
      select: { options: true },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Выбранный финальный вопрос не найден' },
        { status: 400 },
      );
    }

    if (!isFinalChoiceQuestion(question.options as string[])) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message:
            'Финальный вопрос должен иметь ровно 2 варианта «Обвинить» и «Защитить»',
        },
        { status: 400 },
      );
    }
  }

  const settings = await prisma.appSettings.findFirst({ select: { id: true } });

  if (!settings) {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'AppSettings не найдены' },
      { status: 500 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.appSettings.update({
      where: { id: settings.id },
      data: { finalReportQuestionId },
    });

    for (const content of contents) {
      await tx.finalReportContent.upsert({
        where: { finalChoiceValue: content.finalChoiceValue },
        create: {
          finalChoiceValue: content.finalChoiceValue,
          title: content.title,
          bodyText: content.bodyText,
        },
        update: {
          title: content.title,
          bodyText: content.bodyText,
        },
      });
    }
  });

  const [updatedSettings, updatedContents, questions] = await Promise.all([
    prisma.appSettings.findFirst({ select: { finalReportQuestionId: true } }),
    prisma.finalReportContent.findMany({ orderBy: { finalChoiceValue: 'asc' } }),
    prisma.finalReportQuestion.findMany({ orderBy: { orderIndex: 'asc' } }),
  ]);

  const data: HistoryData = {
    finalReportQuestionId: updatedSettings?.finalReportQuestionId ?? null,
    questions: questions.map(serializeQuestion),
    contents: updatedContents.map(serializeContent),
  };

  return NextResponse.json(data);
}
