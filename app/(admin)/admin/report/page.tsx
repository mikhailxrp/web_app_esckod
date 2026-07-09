import React from 'react';
import { prisma } from '@/lib/prisma';
import { QuestionsTable } from '@/components/admin/report/QuestionsTable';
import type { QuestionListItem } from '@/types/admin-report';

export const metadata = {
  title: 'Финальный отчет — Вопросы',
};

function serializeQuestion(question: {
  id: string;
  orderIndex: number;
  questionText: string;
  options: unknown;
  correctOption: number;
  createdAt: Date;
  updatedAt: Date;
}): QuestionListItem {
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

export default async function ReportPage(): Promise<React.ReactElement> {
  const raw = await prisma.finalReportQuestion.findMany({
    orderBy: { orderIndex: 'asc' },
  });

  const questions = raw.map(serializeQuestion);

  return <QuestionsTable initialQuestions={questions} />;
}
