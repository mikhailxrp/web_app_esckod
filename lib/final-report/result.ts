import 'server-only';

import { prisma } from '@/lib/prisma';

interface AnswerSnapshotItem {
  questionText: string;
  selectedLabel: string;
  isCorrect: boolean;
  isFinalQuestion: boolean;
}

interface ResultError {
  error: string;
  status: number;
  details?: Record<string, unknown>;
}

interface LinkBlock {
  blockIndex: number;
  text: string;
  images: unknown;
}

interface ResultSuccess {
  score: {
    correctCount: number;
    totalCount: number;
    percent: number | null;
  };
  answers: AnswerSnapshotItem[];
  finalContent: {
    title: string;
    bodyText: string;
    finalChoiceValue: string;
  };
  linkBlocks: LinkBlock[];
}

type ResultResult = { ok: true; data: ResultSuccess } | { ok: false; error: ResultError };

export async function getResult(userId: string): Promise<ResultResult> {
  const progress = await prisma.gameProgress.findUnique({
    where: { userId },
    select: {
      finalReportDone: true,
      finalScore: true,
      finalReportChoice: true,
      finalReportAnswers: true,
    },
  });

  if (!progress?.finalReportDone) {
    return {
      ok: false,
      error: { error: 'NOT_SUBMITTED', status: 400 },
    };
  }

  if (!progress.finalReportChoice) {
    return {
      ok: false,
      error: { error: 'NO_FINAL_CHOICE', status: 500 },
    };
  }

  const content = await prisma.finalReportContent.findUnique({
    where: { finalChoiceValue: progress.finalReportChoice },
  });

  if (!content) {
    return {
      ok: false,
      error: {
        error: 'FINAL_CONTENT_MISSING',
        status: 500,
        details: { finalChoice: progress.finalReportChoice },
      },
    };
  }

  const answers = (progress.finalReportAnswers ?? []) as unknown as AnswerSnapshotItem[];
  const controlAnswers = answers.filter((a) => !a.isFinalQuestion);
  const correctCount = controlAnswers.filter((a) => a.isCorrect).length;
  const totalCount = controlAnswers.length;

  const linkBlocks = await prisma.finalReportLinkBlock.findMany({
    orderBy: { blockIndex: 'asc' },
    select: { blockIndex: true, text: true, images: true },
  });

  return {
    ok: true,
    data: {
      score: {
        correctCount,
        totalCount,
        percent: progress.finalScore,
      },
      answers,
      finalContent: {
        title: content.title,
        bodyText: content.bodyText,
        finalChoiceValue: content.finalChoiceValue,
      },
      linkBlocks,
    },
  };
}
