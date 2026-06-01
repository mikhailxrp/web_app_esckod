import { z } from 'zod';

export const choiceItemSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const choicesSchema = z.array(choiceItemSchema);

export type ChatChoice = z.infer<typeof choiceItemSchema>;

export function parseChoices(raw: unknown): ChatChoice[] | null {
  const result = choicesSchema.safeParse(raw);

  if (!result.success || result.data.length === 0) {
    return null;
  }

  return result.data;
}
