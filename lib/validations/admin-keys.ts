import { z } from 'zod';

const activationsValueEnum = z.enum(['eq0', 'eq1', 'eq2', 'eq3', 'eq4', 'eq5', 'gt5']);

export const listKeysQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(14),
  q: z.string().optional(),
  status: z.enum(['all', 'active', 'blocked']).default('all'),
  sort: z
    .enum(['createdAt_asc', 'createdAt_desc', 'activations_asc', 'activations_desc'])
    .default('createdAt_desc'),
  activations: z.array(activationsValueEnum).default([]),
  limitChanged: z.coerce.boolean().optional(),
});

export const createKeySchema = z.object({
  key: z.string().min(8, 'Минимум 8 символов').max(100, 'Максимум 100 символов'),
  maxActivations: z.number().int().min(1).max(100).default(5),
});

export const updateKeySchema = z
  .object({
    maxActivations: z.number().int().min(1).optional(),
    isBlocked: z.boolean().optional(),
    blockReason: z.string().max(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field required',
  });

export const importCsvRowSchema = z.object({
  key: z.string().min(8, 'Минимум 8 символов'),
  maxActivations: z.coerce.number().int().min(1).default(5),
});

const activationsExportEnum = z.enum(['all', 'none', 'mid', 'near_limit', 'at_limit']);

export const exportQuerySchema = z.object({
  status: z.enum(['all', 'active', 'blocked']).default('all'),
  activationsExport: activationsExportEnum.default('all'),
  limitChanged: z.coerce.boolean().optional(),
});

export type ListKeysQuery = z.infer<typeof listKeysQuerySchema>;
export type CreateKeyInput = z.infer<typeof createKeySchema>;
export type UpdateKeyInput = z.infer<typeof updateKeySchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
