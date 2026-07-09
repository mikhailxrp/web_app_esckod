import 'server-only';

import { CipherType, LogType, Prisma } from '@prisma/client';

import { CHAT_TRIGGER_EVENTS } from '@/constants/chatTriggerEvents';
import { DECIPHER_SKIP_THRESHOLD } from '@/constants/gameConfig';
import { normalizeRu } from '@/constants/russianAlphabet';
import { advanceTriggerListeners } from '@/lib/chat/triggers';
import { buildPlayfairTable, decipherPlayfair } from '@/lib/decipher/playfair';
import { decipherVigenere, getVigenereDigits } from '@/lib/decipher/vigenere';
import { renderLogMessage } from '@/lib/operationLog';
import { prisma } from '@/lib/prisma';
import type {
  DecipherAttemptOutcome,
  DecipherCompleteOutcome,
  DecipherSkipOutcome,
  DecipherState,
} from '@/types/decipher';

const PLACEHOLDER = '—';

const PLAYFAIR_CONFIG_ERRORS = new Set([
  'PLAYFAIR_ODD_LENGTH',
  'PLAYFAIR_EMPTY_CELL',
  'PLAYFAIR_CHAR_NOT_FOUND',
]);

const VIGENERE_CONFIG_ERRORS = new Set([
  'VIGENERE_EMPTY_KEY',
  'VIGENERE_INVALID_CHAR',
]);

interface DecipherMetadata {
  lastAttemptCorrect: boolean;
  failedAttemptsCount: number;
  skipped: boolean;
  /** Накопительный счётчик неверных вводов — НЕ сбрасывается при успехе. */
  failedAttempts: number;
}

interface DecipherSlotRow {
  id: string;
  slotKey: string;
  missionType: string;
  isActive: boolean;
  displayName: string;
  cipherType: CipherType | null;
  encryptedWord: string | null;
  cipherKey: string | null;
  folderPassword: string | null;
  folderPath: string | null;
  unlocksRdpFolder: string | null;
  hintText: string | null;
}

export type DecipherStateResult =
  | { status: 'ok'; state: DecipherState }
  | { status: 'not_found' };

export type { DecipherAttemptOutcome, DecipherCompleteOutcome, DecipherSkipOutcome } from '@/types/decipher';

function parseMetadata(raw: Prisma.JsonValue | null): DecipherMetadata {
  const base: DecipherMetadata = {
    lastAttemptCorrect: false,
    failedAttemptsCount: 0,
    skipped: false,
    failedAttempts: 0,
  };

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return base;
  }

  const record = raw as Record<string, unknown>;

  if (typeof record.lastAttemptCorrect === 'boolean') {
    base.lastAttemptCorrect = record.lastAttemptCorrect;
  }

  if (typeof record.failedAttemptsCount === 'number') {
    base.failedAttemptsCount = record.failedAttemptsCount;
  }

  if (typeof record.skipped === 'boolean') {
    base.skipped = record.skipped;
  }

  if (typeof record.failedAttempts === 'number') {
    base.failedAttempts = record.failedAttempts;
  }

  return base;
}

function metadataToJson(meta: DecipherMetadata): Prisma.InputJsonValue {
  return meta as unknown as Prisma.InputJsonValue;
}

function isValidDecipherSlot(
  slot: DecipherSlotRow | null,
): slot is DecipherSlotRow & {
  cipherType: CipherType;
  encryptedWord: string;
  cipherKey: string;
} {
  return (
    slot !== null &&
    slot.isActive &&
    slot.missionType === 'DECIPHER' &&
    slot.encryptedWord !== null &&
    slot.cipherKey !== null &&
    slot.cipherType !== null
  );
}

function serverDecrypt(
  cipherType: CipherType,
  encryptedWord: string,
  cipherKey: string,
): string {
  try {
    if (cipherType === 'PLAYFAIR') {
      return decipherPlayfair(encryptedWord, cipherKey);
    }

    if (cipherType === 'VIGENERE') {
      return decipherVigenere(encryptedWord, cipherKey);
    }

    throw new Error('INVALID_CIPHER_TYPE');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVALID_CIPHER_TYPE') {
        throw error;
      }

      if (
        PLAYFAIR_CONFIG_ERRORS.has(error.message) ||
        VIGENERE_CONFIG_ERRORS.has(error.message)
      ) {
        throw new Error('BAD_SLOT_CONTENT');
      }
    }

    throw error;
  }
}

function mapDecryptError(error: unknown): DecipherAttemptOutcome {
  if (error instanceof Error) {
    if (error.message === 'INVALID_CIPHER_TYPE') {
      return { type: 'BAD_SLOT_CONTENT', reason: 'INVALID_CIPHER_TYPE' };
    }

    if (error.message === 'BAD_SLOT_CONTENT') {
      return { type: 'BAD_SLOT_CONTENT', reason: 'BAD_SLOT_CONTENT' };
    }
  }

  throw error;
}

const SLOT_SELECT = {
  id: true,
  slotKey: true,
  missionType: true,
  isActive: true,
  displayName: true,
  cipherType: true,
  encryptedWord: true,
  cipherKey: true,
  folderPassword: true,
  folderPath: true,
  unlocksRdpFolder: true,
  hintText: true,
} as const;

function buildActiveState(
  slot: DecipherSlotRow & {
    cipherType: CipherType;
    encryptedWord: string;
    cipherKey: string;
  },
): DecipherState {
  const base = {
    isCompleted: false as const,
    cipherType: slot.cipherType,
    encryptedWord: slot.encryptedWord,
    cipherKey: slot.cipherKey,
    folderName: slot.unlocksRdpFolder,
    hintText: slot.hintText,
  };

  if (slot.cipherType === 'PLAYFAIR') {
    return {
      ...base,
      playfairTable: buildPlayfairTable(slot.cipherKey),
    };
  }

  return {
    ...base,
    vigenereDigits: getVigenereDigits(slot.encryptedWord),
  };
}

export async function getDecipherState(
  userId: string,
  slotKey: string,
): Promise<DecipherStateResult> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: SLOT_SELECT,
  });

  if (!isValidDecipherSlot(slot)) {
    return { status: 'not_found' };
  }

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  if (progress?.completed) {
    return {
      status: 'ok',
      state: {
        isCompleted: true,
        cipherType: slot.cipherType,
        encryptedWord: slot.encryptedWord,
        cipherKey: slot.cipherKey,
        hintText: slot.hintText,
        folderPassword: slot.folderPassword,
        folderPath: slot.folderPath,
      },
    };
  }

  return {
    status: 'ok',
    state: buildActiveState(slot),
  };
}

export async function applyDecipherAttempt(
  userId: string,
  slotKey: string,
  decryptedWord: string,
): Promise<DecipherAttemptOutcome> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: SLOT_SELECT,
  });

  if (!slot || !slot.isActive || slot.missionType !== 'DECIPHER') {
    return { type: 'SLOT_NOT_FOUND' };
  }

  if (slot.cipherType === null) {
    return { type: 'BAD_SLOT_CONTENT', reason: 'INVALID_CIPHER_TYPE' };
  }

  if (slot.encryptedWord === null || slot.cipherKey === null) {
    return { type: 'BAD_SLOT_CONTENT', reason: 'BAD_SLOT_CONTENT' };
  }

  let serverDecrypted: string;

  try {
    serverDecrypted = serverDecrypt(
      slot.cipherType,
      slot.encryptedWord,
      slot.cipherKey,
    );
  } catch (error) {
    return mapDecryptError(error);
  }

  const playerAnswer = normalizeRu(decryptedWord.trim());
  const expected = normalizeRu(serverDecrypted.trim());
  const isCorrect = playerAnswer === expected;

  const existingProgress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });
  const currentMeta = parseMetadata(existingProgress?.metadata ?? null);

  const failedAttemptsCount = isCorrect
    ? 0
    : currentMeta.failedAttemptsCount + 1;

  const nextMeta: DecipherMetadata = {
    lastAttemptCorrect: isCorrect,
    failedAttemptsCount,
    skipped: false,
    failedAttempts: currentMeta.failedAttempts + (isCorrect ? 0 : 1),
  };

  await prisma.missionProgress.upsert({
    where: { userId_slotId: { userId, slotId: slot.id } },
    create: {
      userId,
      slotId: slot.id,
      completed: false,
      metadata: metadataToJson(nextMeta),
    },
    update: {
      metadata: metadataToJson(nextMeta),
      version: { increment: 1 },
    },
  });

  if (isCorrect) {
    return { type: 'CORRECT' };
  }

  return {
    type: 'INCORRECT',
    canSkip: failedAttemptsCount >= DECIPHER_SKIP_THRESHOLD,
  };
}

interface CompletionSlot {
  id: string;
  slotKey: string;
  displayName: string;
  folderPassword: string | null;
  folderPath: string | null;
}

async function finalizeDecipherMission(
  userId: string,
  slot: CompletionSlot,
  options: { skipped: boolean },
): Promise<{ folderPassword: string | null; folderPath: string | null }> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.missionProgress.findUnique({
      where: { userId_slotId: { userId, slotId: slot.id } },
    });
    const meta = parseMetadata(existing?.metadata ?? null);

    if (options.skipped) {
      await tx.missionProgress.update({
        where: { userId_slotId: { userId, slotId: slot.id } },
        data: {
          completed: true,
          completedAt: new Date(),
          metadata: metadataToJson({
            lastAttemptCorrect: meta.lastAttemptCorrect,
            failedAttemptsCount: meta.failedAttemptsCount,
            skipped: true,
            failedAttempts: meta.failedAttempts,
          }),
          version: { increment: 1 },
        },
      });
    } else {
      await tx.missionProgress.update({
        where: { userId_slotId: { userId, slotId: slot.id } },
        data: {
          completed: true,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
    }

    await tx.missionCompletionStats.create({
      data: {
        userId,
        slotId: slot.id,
        skipped: options.skipped,
        failedAttempts: meta.failedAttempts,
      },
    });

    await tx.operationLog.create({
      data: {
        userId,
        type: LogType.SUCCESS,
        message: renderLogMessage('decipher_access_granted', {
          folderPath: slot.folderPath ?? PLACEHOLDER,
          folderPassword: slot.folderPassword ?? PLACEHOLDER,
        }),
      },
    });

    await tx.operationLog.create({
      data: {
        userId,
        type: LogType.SUCCESS,
        message: renderLogMessage('mission_completed_overview', {
          displayName: slot.displayName,
        }),
      },
    });

    await advanceTriggerListeners(
      tx,
      userId,
      CHAT_TRIGGER_EVENTS.DECIPHER_COMPLETED(slot.slotKey),
    );
  });

  return {
    folderPassword: slot.folderPassword,
    folderPath: slot.folderPath,
  };
}

export async function completeDecipher(
  userId: string,
  slotKey: string,
): Promise<DecipherCompleteOutcome> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: SLOT_SELECT,
  });

  if (!isValidDecipherSlot(slot)) {
    return { type: 'SLOT_NOT_FOUND' };
  }

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  if (progress?.completed) {
    return {
      type: 'SUCCESS',
      folderPassword: slot.folderPassword,
      folderPath: slot.folderPath,
    };
  }

  const meta = parseMetadata(progress?.metadata ?? null);

  if (!progress || !meta.lastAttemptCorrect) {
    return { type: 'NOT_SOLVED' };
  }

  const result = await finalizeDecipherMission(userId, slot, { skipped: false });

  return {
    type: 'SUCCESS',
    folderPassword: result.folderPassword,
    folderPath: result.folderPath,
  };
}

export async function skipDecipher(
  userId: string,
  slotKey: string,
): Promise<DecipherSkipOutcome> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: SLOT_SELECT,
  });

  if (!isValidDecipherSlot(slot)) {
    return { type: 'SLOT_NOT_FOUND' };
  }

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  if (progress?.completed) {
    return {
      type: 'SUCCESS',
      folderPassword: slot.folderPassword,
      folderPath: slot.folderPath,
    };
  }

  const meta = parseMetadata(progress?.metadata ?? null);

  if (!progress || meta.failedAttemptsCount < DECIPHER_SKIP_THRESHOLD) {
    return { type: 'CANNOT_SKIP' };
  }

  const result = await finalizeDecipherMission(userId, slot, { skipped: true });

  return {
    type: 'SUCCESS',
    folderPassword: result.folderPassword,
    folderPath: result.folderPath,
  };
}
