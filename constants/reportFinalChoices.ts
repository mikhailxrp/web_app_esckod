export const REPORT_FINAL_CHOICES = [
  { value: 'ACCUSE', label: 'Обвинить' },
  { value: 'PROTECT', label: 'Защитить' },
] as const;

export type ReportFinalChoiceValue =
  (typeof REPORT_FINAL_CHOICES)[number]['value'];
