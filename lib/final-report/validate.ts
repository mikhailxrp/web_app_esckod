import {
  REPORT_FINAL_CHOICES,
  type ReportFinalChoiceValue,
} from '@/constants/reportFinalChoices';
import { prisma } from '@/lib/prisma';
import { isFinalChoiceQuestion } from './isFinalChoiceQuestion';

const CHOICE_VALUES = new Set<ReportFinalChoiceValue>(
  REPORT_FINAL_CHOICES.map((choice) => choice.value),
);

function isReportFinalChoiceValue(value: string): value is ReportFinalChoiceValue {
  return CHOICE_VALUES.has(value as ReportFinalChoiceValue);
}

export async function validateReportConfig(): Promise<{
  isValid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  const [contents, settings] = await Promise.all([
    prisma.finalReportContent.findMany(),
    prisma.appSettings.findFirst({
      select: { finalReportQuestionId: true },
    }),
  ]);

  const contentValues = new Set(contents.map((content) => content.finalChoiceValue));

  for (const choice of REPORT_FINAL_CHOICES) {
    if (!contentValues.has(choice.value)) {
      issues.push(`MISSING_CONTENT:${choice.value}`);
    }
  }

  for (const content of contents) {
    if (!isReportFinalChoiceValue(content.finalChoiceValue)) {
      issues.push(`ORPHAN_CONTENT:${content.finalChoiceValue}`);
    }
  }

  for (const content of contents) {
    if (content.finalChoiceValue !== content.finalChoiceValue.toUpperCase()) {
      issues.push(`NOT_UPPERCASE:${content.finalChoiceValue}`);
    }
  }

  if (!settings?.finalReportQuestionId) {
    issues.push('NO_FINAL_QUESTION');
  } else {
    const question = await prisma.finalReportQuestion.findUnique({
      where: { id: settings.finalReportQuestionId },
      select: { options: true },
    });

    if (!question) {
      issues.push('FINAL_QUESTION_NOT_FOUND');
    } else {
      const options = question.options as string[];
      if (!isFinalChoiceQuestion(options)) {
        issues.push('FINAL_QUESTION_BAD_OPTIONS');
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
