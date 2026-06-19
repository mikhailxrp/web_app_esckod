import { REPORT_FINAL_CHOICES } from '@/constants/reportFinalChoices';

/** Вопрос с вариантами «Обвинить / Защитить» — финальный нарративный, удаление запрещено в UI. */
export function isFinalChoiceQuestion(options: string[]): boolean {
  const trimmed = options.map((option) => option.trim()).filter(Boolean);
  const choiceLabels = REPORT_FINAL_CHOICES.map((choice) => choice.label);

  if (trimmed.length !== choiceLabels.length) {
    return false;
  }

  return choiceLabels.every((label) => trimmed.includes(label));
}
