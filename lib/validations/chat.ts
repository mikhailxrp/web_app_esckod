import { z } from 'zod';

const chatTypeSchema = z.enum(['DETECTIVE', 'MARINA']);

export const advanceSchema = z.object({
  chatType: chatTypeSchema,
  expectedVersion: z.number().int().nonnegative(),
});

export const choiceSchema = advanceSchema.extend({
  value: z.string().min(1),
});

export type AdvanceInput = z.infer<typeof advanceSchema>;
export type ChoiceInput = z.infer<typeof choiceSchema>;
