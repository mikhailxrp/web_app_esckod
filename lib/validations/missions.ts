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
  cipherKey: z.string().min(1, 'Укажите корректное кодовое слово').transform((v) => v.toUpperCase()),
});

export const decipherAttemptSchema = z.object({
  decryptedWord: z.string().min(1).max(50),
});

export const rdpLaunchSchema = z.object({
  ip: z.string().regex(/^\d{1,3}(\.\d{1,3}){3}$/, 'Введите корректный IP'),
});

export const rdpRotateTileSchema = z.object({
  tileId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export const rdpCheckPuzzleSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});

export const rdpTimerExpiredSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});

export const rdpSkipSchema = z.object({
  expectedVersion: z.number().int().nonnegative().optional(),
});

export const rdpUnlockFolderSchema = z.object({
  folderName: z.string().min(1),
  password: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export const rdpFileViewedSchema = z.object({
  fileId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export const rdpCompleteSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});

export const rdpCopyFolderPathSchema = z.object({
  folderName: z.string().min(1),
});

export type CrackLaunchInput = z.infer<typeof crackLaunchSchema>;
export type CrackAttemptInput = z.infer<typeof crackAttemptSchema>;
export type DecipherLaunchInput = z.infer<typeof decipherLaunchSchema>;
export type DecipherAttemptInput = z.infer<typeof decipherAttemptSchema>;
export type RdpLaunchInput = z.infer<typeof rdpLaunchSchema>;
export type RdpRotateTileInput = z.infer<typeof rdpRotateTileSchema>;
export type RdpCheckPuzzleInput = z.infer<typeof rdpCheckPuzzleSchema>;
export type RdpTimerExpiredInput = z.infer<typeof rdpTimerExpiredSchema>;
export type RdpSkipInput = z.infer<typeof rdpSkipSchema>;
export type RdpUnlockFolderInput = z.infer<typeof rdpUnlockFolderSchema>;
export type RdpFileViewedInput = z.infer<typeof rdpFileViewedSchema>;
export type RdpCompleteInput = z.infer<typeof rdpCompleteSchema>;
export type RdpCopyFolderPathInput = z.infer<typeof rdpCopyFolderPathSchema>;
