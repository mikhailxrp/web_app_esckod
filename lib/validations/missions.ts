import { z } from 'zod';

export const crackLaunchSchema = z.object({
  url: z.string().url('Введите корректный URL'),
  login: z.string().email('Введите корректный email'),
});

export const decipherLaunchSchema = z.object({
  folderPath: z.string().min(1, 'Укажите ссылку или путь к папке'),
  cipherKey: z.string().min(1, 'Укажите ключ'),
});

export const rdpLaunchSchema = z.object({
  ip: z.string().regex(/^\d{1,3}(\.\d{1,3}){3}$/, 'Введите корректный IP'),
});

export type CrackLaunchInput = z.infer<typeof crackLaunchSchema>;
export type DecipherLaunchInput = z.infer<typeof decipherLaunchSchema>;
export type RdpLaunchInput = z.infer<typeof rdpLaunchSchema>;
