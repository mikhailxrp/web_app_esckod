import {
  REPORT_FINAL_CHOICES,
  type ReportFinalChoiceValue,
} from '@/constants/reportFinalChoices';
import { prisma } from '@/lib/prisma';

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
  const contents = await prisma.finalReportContent.findMany();
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

  return {
    isValid: issues.length === 0,
    issues,
  };
}
