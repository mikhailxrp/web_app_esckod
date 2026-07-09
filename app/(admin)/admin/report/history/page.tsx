import React from 'react';
import { prisma } from '@/lib/prisma';
import { HistoryForm } from '@/components/admin/report/HistoryForm';
import { ReportValidatorBanner } from '@/components/admin/report/ReportValidatorBanner';
import { validateReportConfig } from '@/lib/final-report/validate';
import type { HistoryData, QuestionListItem, ContentItem } from '@/types/admin-report';

export const metadata = {
  title: 'Финальный отчет — История',
};

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

export default async function ReportHistoryPage(): Promise<React.ReactElement> {
  const [settings, questions, contents, validation] = await Promise.all([
    prisma.appSettings.findFirst({ select: { finalReportQuestionId: true } }),
    prisma.finalReportQuestion.findMany({ orderBy: { orderIndex: 'asc' } }),
    prisma.finalReportContent.findMany({ orderBy: { finalChoiceValue: 'asc' } }),
    validateReportConfig(),
  ]);

  const data: HistoryData = {
    finalReportQuestionId: settings?.finalReportQuestionId ?? null,
    questions: questions.map(serializeQuestion),
    contents: contents.map(serializeContent),
  };

  return (
    <div>
      <ReportValidatorBanner initialValidation={validation} />
      <HistoryForm initialData={data} />
    </div>
  );
}
