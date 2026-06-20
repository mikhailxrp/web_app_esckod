import { z } from 'zod';

import { REPORT_FINAL_CHOICES } from '@/constants/reportFinalChoices';

const reportFinalChoiceSchema = z.enum(
  REPORT_FINAL_CHOICES.map((choice) => choice.value) as [string, ...string[]],
);

export const submitSchema = z.object({
  finalChoice: reportFinalChoiceSchema,
  answers: z
    .array(
      z.object({
        questionId: z.string().cuid(),
        selectedOption: z.number().int().min(0),
      }),
    )
    .min(1),
  expectedVersion: z.number().int().min(0),
});

export type SubmitBody = z.infer<typeof submitSchema>;
