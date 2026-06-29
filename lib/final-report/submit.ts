import 'server-only';

import { LogType, Prisma } from '@prisma/client';

import { writeLog } from '@/lib/operationLog';
import { prisma } from '@/lib/prisma';
import type { SubmitBody } from '@/lib/validations/final-report';

import { checkAvailability } from './availability';

interface AnswerSnapshotItem {
  questionText: string;
  selectedLabel: string;
  isCorrect: boolean;
  isFinalQuestion: boolean;
}

interface SubmitError {
  error: string;
  status: number;
  details?: Record<string, unknown>;
}

interface SubmitSuccess {
  score: {
    correctCount: number;
    totalCount: number;
    percent: number;
  };
  finalContent: {
    title: string;
    bodyText: string;
    finalChoiceValue: string;
  };
  version: number;
}

type SubmitResult = { ok: true; data: SubmitSuccess } | { ok: false; error: SubmitError };

interface SubmitContext {
  ip?: string | null;
  userAgent?: string | null;
}

export async function submitReport(userId: string, body: SubmitBody, context?: SubmitContext): Promise<SubmitResult> {
  const availability = await checkAvailability(userId);

  if (!availability.available && !availability.alreadySubmitted) {
    return {
      ok: false,
      error: {
        error: 'NOT_AVAILABLE',
        status: 400,
        details: { reasons: availability.reasonsBlocked },
      },
    };
  }

  if (availability.alreadySubmitted) {
    return {
      ok: false,
      error: { error: 'ALREADY_SUBMITTED', status: 400 },
    };
  }

  const { finalChoice, answers, expectedVersion } = body;

  const [questions, settings] = await Promise.all([
    prisma.finalReportQuestion.findMany({
      orderBy: { orderIndex: 'asc' },
    }),
    prisma.appSettings.findFirst({
      select: { finalReportQuestionId: true },
    }),
  ]);

  const answeredIds = new Set(answers.map((a) => a.questionId));
  const missingIds = questions.filter((q) => !answeredIds.has(q.id));
  if (missingIds.length > 0) {
    return {
      ok: false,
      error: { error: 'INCOMPLETE_ANSWERS', status: 400 },
    };
  }

  const finalQuestionId = settings?.finalReportQuestionId ?? null;

  let correctCount = 0;
  let controlCount = 0;
  const answerSnapshot: AnswerSnapshotItem[] = [];

  for (const q of questions) {
    const userAnswer = answers.find((a) => a.questionId === q.id);
    if (!userAnswer) continue;

    const options = q.options as string[];
    const isFinalQuestion = q.id === finalQuestionId;

    if (userAnswer.selectedOption < 0 || userAnswer.selectedOption >= options.length) {
      return {
        ok: false,
        error: {
          error: 'INVALID_OPTION_INDEX',
          status: 400,
          details: {
            questionId: q.id,
            selectedOption: userAnswer.selectedOption,
            maxAllowed: options.length - 1,
          },
        },
      };
    }

    const isCorrect = userAnswer.selectedOption === q.correctOption;
    answerSnapshot.push({
      questionText: q.questionText,
      selectedLabel: options[userAnswer.selectedOption],
      isCorrect,
      isFinalQuestion,
    });

    if (!isFinalQuestion) {
      controlCount++;
      if (isCorrect) correctCount++;
    }
  }

  const percent = controlCount > 0 ? Math.round((correctCount / controlCount) * 100) : 0;

  const content = await prisma.finalReportContent.findUnique({
    where: { finalChoiceValue: finalChoice },
  });

  if (!content) {
    return {
      ok: false,
      error: {
        error: 'FINAL_CONTENT_MISSING',
        status: 500,
        details: { finalChoice },
      },
    };
  }

  let updated: { version: number };
  try {
    updated = await prisma.gameProgress.update({
      where: { userId, version: expectedVersion },
      data: {
        finalReportDone: true,
        finalScore: percent,
        finalReportChoice: finalChoice,
        finalReportAnswers: answerSnapshot as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
      select: { version: true },
    });
  } catch (err) {
    const prismaError = err as { code?: string };
    if (prismaError.code === 'P2025') {
      return {
        ok: false,
        error: { error: 'VERSION_CONFLICT', status: 409 },
      };
    }
    throw err;
  }

  await prisma.gameCompletion.create({
    data: {
      userId,
      finalScore: percent,
      ipAddress: context?.ip ?? null,
      userAgent: context?.userAgent ?? null,
    },
  });

  await writeLog({
    userId,
    templateKey: 'final_report_submitted',
    params: { percent: String(percent) },
    type: LogType.SUCCESS,
  });

  return {
    ok: true,
    data: {
      score: {
        correctCount,
        totalCount: controlCount,
        percent,
      },
      finalContent: {
        title: content.title,
        bodyText: content.bodyText,
        finalChoiceValue: content.finalChoiceValue,
      },
      version: updated.version,
    },
  };
}
