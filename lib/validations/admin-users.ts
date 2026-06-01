import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['all', 'active', 'blocked']).default('all'),
  sort: z.enum(['createdAt_desc', 'createdAt_asc']).default('createdAt_desc'),
});

export const updateUserSchema = z.object({
  isBlocked: z.boolean(),
  blockReason: z.string().max(500).optional(),
});

export const exportUsersQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['all', 'active', 'blocked']).default('all'),
  consent: z.coerce.boolean().optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ExportUsersQuery = z.infer<typeof exportUsersQuerySchema>;
