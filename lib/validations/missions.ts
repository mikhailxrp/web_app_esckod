import { z } from 'zod';

import { CRACK_WORD_LENGTH } from '@/constants/gameConfig';

export const crackLaunchSchema = z.object({
  targetUrl: z.string().url('Введите корректный URL'),
  targetEmail: z.string().min(1, 'Введите логин'),
});

export const crackAttemptSchema = z.object({
  word: z.string().length(CRACK_WORD_LENGTH, 'Слово должно содержать 5 букв'),
  expectedVersion: z.number().int().nonnegative(),
});

export const decipherLaunchSchema = z.object({
  folderPath: z.string().min(1, 'Укажите ссылку или путь к папке'),
  cipherKey: z.string().min(1, 'Укажите ключ'),
});

export const rdpLaunchSchema = z.object({
  ip: z.string().regex(/^\d{1,3}(\.\d{1,3}){3}$/, 'Введите корректный IP'),
});

export type CrackLaunchInput = z.infer<typeof crackLaunchSchema>;
export type CrackAttemptInput = z.infer<typeof crackAttemptSchema>;
export type DecipherLaunchInput = z.infer<typeof decipherLaunchSchema>;
export type RdpLaunchInput = z.infer<typeof rdpLaunchSchema>;
