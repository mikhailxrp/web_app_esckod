import { z } from 'zod';

export const choiceItemSchema = z.object({
  label: z.string().min(1, 'Метка не может быть пустой'),
  value: z.string().min(1, 'Значение не может быть пустым'),
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

const chatAuthorSchema = z.enum(['DETECTIVE', 'PLAYER', 'MARINA', 'ANONYMOUS']);

export const createScriptSchema = z
  .object({
    chatType: z.enum(['DETECTIVE', 'MARINA']),
    author: chatAuthorSchema.default('DETECTIVE'),
    code: z.string().min(1, 'Код обязателен'),
    text: z.string().min(1, 'Текст обязателен'),
    hasChoices: z.boolean().default(false),
    isStart: z.boolean().default(false),
    isEnd: z.boolean().default(false),
    choices: choicesSchema.optional(),
  })
  .refine(
    (data) =>
      !data.hasChoices || (Array.isArray(data.choices) && data.choices.length > 0),
    { message: 'При hasChoices=true необходимо указать варианты выбора', path: ['choices'] },
  );

export const updateScriptSchema = z
  .object({
    author: chatAuthorSchema.optional(),
    text: z.string().min(1, 'Текст обязателен').optional(),
    hasChoices: z.boolean().optional(),
    isStart: z.boolean().optional(),
    isEnd: z.boolean().optional(),
    choices: choicesSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.hasChoices === true) {
        return Array.isArray(data.choices) && data.choices.length > 0;
      }

      return true;
    },
    { message: 'При hasChoices=true необходимо указать варианты выбора', path: ['choices'] },
  );

export type CreateScriptInput = z.input<typeof createScriptSchema>;
export type UpdateScriptInput = z.input<typeof updateScriptSchema>;
export type CreateScriptOutput = z.infer<typeof createScriptSchema>;
export type UpdateScriptOutput = z.infer<typeof updateScriptSchema>;

export const listScriptsQuerySchema = z.object({
  chatType: z.enum(['DETECTIVE', 'MARINA']).optional(),
});
