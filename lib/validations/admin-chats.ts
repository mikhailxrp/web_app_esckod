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

const transitionBaseSchema = z.object({
  fromMessageId: z.string().min(1),
  toMessageId: z.string().min(1),
  priority: z.number().int().default(0),
});

const alwaysTransitionSchema = transitionBaseSchema.extend({
  conditionType: z.literal('ALWAYS'),
  conditionValue: z.null().optional(),
});

const choiceTransitionSchema = transitionBaseSchema.extend({
  conditionType: z.literal('CHOICE'),
  conditionValue: z.string().min(1, 'Значение условия обязательно'),
});

const triggerTransitionSchema = transitionBaseSchema.extend({
  conditionType: z.literal('TRIGGER'),
  conditionValue: z.string().min(1, 'Значение условия обязательно'),
});

export const createTransitionSchema = z.discriminatedUnion('conditionType', [
  alwaysTransitionSchema,
  choiceTransitionSchema,
  triggerTransitionSchema,
]);

export const updateTransitionSchema = z.object({
  fromMessageId: z.string().min(1).optional(),
  toMessageId: z.string().min(1).optional(),
  conditionType: z.enum(['ALWAYS', 'CHOICE', 'TRIGGER']).optional(),
  conditionValue: z.union([z.string(), z.null()]).optional(),
  priority: z.number().int().optional(),
});

export type CreateTransitionInput = z.input<typeof createTransitionSchema>;
export type CreateTransitionOutput = z.infer<typeof createTransitionSchema>;
export type UpdateTransitionInput = z.input<typeof updateTransitionSchema>;
export type UpdateTransitionOutput = z.infer<typeof updateTransitionSchema>;
