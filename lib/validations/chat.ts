import { z } from 'zod';

const chatTypeSchema = z.enum(['DETECTIVE', 'MARINA']);

export const advanceSchema = z.object({
  chatType: chatTypeSchema,
  expectedVersion: z.number().int().nonnegative(),
});

export const choiceSchema = advanceSchema.extend({
  value: z.string().min(1),
});

export const messagesQuerySchema = z.object({
  chatType: chatTypeSchema,
});

export type AdvanceInput = z.infer<typeof advanceSchema>;
export type ChoiceInput = z.infer<typeof choiceSchema>;
export type MessagesQueryInput = z.infer<typeof messagesQuerySchema>;
