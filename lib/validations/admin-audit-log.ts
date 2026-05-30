import { z } from 'zod';

export const querySchema = z.object({
  type: z.string().optional(),
  userId: z.string().cuid().optional(),
  adminId: z.string().cuid().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().cuid().optional(),
});

export type AuditLogQuery = z.infer<typeof querySchema>;
