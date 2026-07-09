import type { CipherType } from '@prisma/client';

interface DecipherStateActive {
  isCompleted: false;
  cipherType: CipherType;
  encryptedWord: string;
  cipherKey: string;
  folderName: string | null;
  hintText: string | null;
  playfairTable?: string[][];
  vigenereDigits?: number[];
}

interface DecipherStateCompleted {
  isCompleted: true;
  cipherType: CipherType;
  encryptedWord: string;
  cipherKey: string;
  hintText: string | null;
  folderPassword: string | null;
  folderPath: string | null;
}

export type DecipherState = DecipherStateActive | DecipherStateCompleted;

export interface DecipherAttemptResult {
  isCorrect: boolean;
  canSkip: boolean;
}

export interface DecipherCompleteResult {
  success: true;
  folderPassword: string | null;
  folderPath: string | null;
}

export type DecipherAttemptOutcome =
  | { type: 'CORRECT' }
  | { type: 'INCORRECT'; canSkip: boolean }
  | { type: 'SLOT_NOT_FOUND' }
  | { type: 'BAD_SLOT_CONTENT'; reason: string };

export type DecipherCompleteOutcome =
  | { type: 'SUCCESS'; folderPassword: string | null; folderPath: string | null }
  | { type: 'NOT_SOLVED' }
  | { type: 'SLOT_NOT_FOUND' };

export type DecipherSkipOutcome =
  | { type: 'SUCCESS'; folderPassword: string | null; folderPath: string | null }
  | { type: 'CANNOT_SKIP' }
  | { type: 'SLOT_NOT_FOUND' };
