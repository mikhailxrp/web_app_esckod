import { z } from 'zod';

const questionOptionsSchema = z
  .array(z.string().trim().min(1, 'Вариант ответа не может быть пустым'))
  .min(2, 'Нужно минимум 2 варианта ответа');

function validateCorrectOptionRange(
  data: { options?: string[]; correctOption?: number },
  ctx: z.RefinementCtx,
): void {
  if (data.options === undefined || data.correctOption === undefined) {
    return;
  }

  if (data.correctOption < 0 || data.correctOption >= data.options.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `correctOption должен быть в диапазоне 0..${data.options.length - 1}`,
      path: ['correctOption'],
    });
  }
}

const questionBaseSchema = z.object({
  questionText: z.string().trim().min(1, 'Текст вопроса обязателен'),
  options: questionOptionsSchema,
  correctOption: z.number().int().min(0),
  orderIndex: z.number().int().min(1, 'Порядковый номер должен быть ≥ 1'),
});

export const createQuestionSchema = questionBaseSchema.superRefine(
  validateCorrectOptionRange,
);

export const updateQuestionSchema = questionBaseSchema
  .partial()
  .superRefine(validateCorrectOptionRange);

export const reorderQuestionsItemSchema = z.object({
  id: z.string().cuid(),
  newOrderIndex: z.number().int().min(1, 'Порядковый номер должен быть ≥ 1'),
});

export const reorderQuestionsSchema = z
  .array(reorderQuestionsItemSchema)
  .min(1, 'Нужен хотя бы один элемент для переупорядочивания');

export const createContentSchema = z.object({
  finalChoiceValue: z
    .string()
    .regex(/^[A-Z_]+$/, 'finalChoiceValue должен быть UPPERCASE'),
  title: z.string().trim().min(1, 'Заголовок обязателен'),
  bodyText: z.string().trim().min(1, 'Текст концовки обязателен'),
});

export const updateContentSchema = z
  .object({
    title: z.string().trim().min(1, 'Заголовок не может быть пустым'),
    bodyText: z.string().trim().min(1, 'Текст концовки не может быть пустым'),
  })
  .partial()
  .refine((data) => data.title !== undefined || data.bodyText !== undefined, {
    message: 'Необходимо передать хотя бы одно поле для обновления',
  });

export type CreateQuestionInput = z.input<typeof createQuestionSchema>;
export type CreateQuestionOutput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.input<typeof updateQuestionSchema>;
export type UpdateQuestionOutput = z.infer<typeof updateQuestionSchema>;
export type ReorderQuestionsInput = z.input<typeof reorderQuestionsSchema>;
export type ReorderQuestionsOutput = z.infer<typeof reorderQuestionsSchema>;
export type CreateContentInput = z.input<typeof createContentSchema>;
export type CreateContentOutput = z.infer<typeof createContentSchema>;
export type UpdateContentInput = z.input<typeof updateContentSchema>;
export type UpdateContentOutput = z.infer<typeof updateContentSchema>;

const contentItemSchema = z.object({
  finalChoiceValue: z.enum(['ACCUSE', 'PROTECT'], {
    errorMap: () => ({ message: 'finalChoiceValue должен быть ACCUSE или PROTECT' }),
  }),
  title: z.string().trim().min(1, 'Заголовок обязателен'),
  bodyText: z.string().trim().min(1, 'Текст концовки обязателен'),
});

export const updateHistorySchema = z.object({
  finalReportQuestionId: z.string().cuid().nullable(),
  contents: z
    .array(contentItemSchema)
    .length(2, 'Необходимо передать ровно 2 концовки'),
});

export const updateLinksSchema = z.object({
  blocks: z
    .array(
      z.object({
        blockIndex: z.union([z.literal(1), z.literal(2)]),
        text: z.string(),
      }),
    )
    .length(2, 'Необходимо передать ровно 2 блока'),
});

export const MAX_LINK_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const linkImageUploadFieldsSchema = z.object({
  blockIndex: z
    .string()
    .transform(Number)
    .pipe(z.union([z.literal(1), z.literal(2)])),
});

export const linkImageDeleteSchema = z.object({
  blockIndex: z.union([z.literal(1), z.literal(2)]),
  key: z.string().min(1, 'key не может быть пустым'),
});

export type UpdateHistoryInput = z.infer<typeof updateHistorySchema>;
export type UpdateLinksInput = z.infer<typeof updateLinksSchema>;
export type LinkImageUploadFields = z.infer<typeof linkImageUploadFieldsSchema>;
export type LinkImageDeleteInput = z.infer<typeof linkImageDeleteSchema>;
