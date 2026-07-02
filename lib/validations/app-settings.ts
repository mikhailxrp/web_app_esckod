import { z } from 'zod';

export const updateSettingsSchema = z.object({
  supportEmail: z
    .string()
    .email('Некорректный email')
    .optional(),
  privacyPolicyText: z.string().optional(),
  defaultMarketingConsent: z.boolean().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
