import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .regex(
      /^[a-zA-Zа-яА-ЯеЕ0-9_]+$/,
      'Имя может содержать только буквы (русские или латинские), цифры и знак подчеркивания',
    )
    .min(3, 'Имя должно содержать минимум 3 символа'),
  email: z.string().email('Введите корректный email').toLowerCase().trim(),
  accessKey: z.string().min(1, 'Введите ключ доступа').trim(),
  consentPolicy: z.literal(true, {
    errorMap: () => ({ message: 'Согласие обязательно' }),
  }),
  consentMarketing: z.boolean(),
});

export const registerFormSchema = registerSchema
  .omit({ consentPolicy: true })
  .extend({
    consentPolicy: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.consentPolicy !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Согласие обязательно',
        path: ['consentPolicy'],
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormInput = z.infer<typeof registerFormSchema>;

export const loginFormSchema = z.object({
  email: z.string().email('Введите корректный email').toLowerCase().trim(),
  password: z.string().min(1, 'Введите пароль'),
});

export type LoginFormInput = z.infer<typeof loginFormSchema>;

export const checkBlockSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export type CheckBlockInput = z.infer<typeof checkBlockSchema>;

export const resetSchema = z.object({
  email: z.string().email('Введите корректный email').toLowerCase().trim(),
});

export type ResetInput = z.infer<typeof resetSchema>;
