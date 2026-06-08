import { z } from 'zod';

export const createHintSchema = z.object({
  text: z.string().trim().min(1, 'Текст подсказки обязателен'),
  orderIndex: z.number().int().min(1, 'Порядковый номер должен быть ≥ 1'),
  isActive: z.boolean().default(true),
});

export const updateHintSchema = z
  .object({
    text: z.string().trim().min(1, 'Текст подсказки не может быть пустым').optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.text !== undefined || data.isActive !== undefined, {
    message: 'Необходимо передать хотя бы одно поле для обновления',
  });

export const reorderItemSchema = z.object({
  id: z.string().cuid(),
  newOrderIndex: z.number().int().min(1, 'Порядковый номер должен быть ≥ 1'),
});

export const reorderSchema = z.array(reorderItemSchema).min(1);

export type CreateHintInput = z.input<typeof createHintSchema>;
export type CreateHintOutput = z.infer<typeof createHintSchema>;
export type UpdateHintInput = z.input<typeof updateHintSchema>;
export type UpdateHintOutput = z.infer<typeof updateHintSchema>;
export type ReorderInput = z.input<typeof reorderSchema>;
export type ReorderOutput = z.infer<typeof reorderSchema>;
