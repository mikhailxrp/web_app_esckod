import { z } from 'zod';

export const createAdminSchema = z.object({
  email: z
    .string()
    .email('Некорректный email')
    .transform((v) => v.trim().toLowerCase()),
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
