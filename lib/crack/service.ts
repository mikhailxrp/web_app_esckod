import 'server-only';

import { LogType, Prisma } from '@prisma/client';

import { CHAT_TRIGGER_EVENTS } from '@/constants/chatTriggerEvents';
import {
  CRACK_DEFAULT_MAX_ATTEMPTS,
  CRACK_SKIP_THRESHOLD,
} from '@/constants/gameConfig';
import { advanceTriggerListeners } from '@/lib/chat/triggers';
import { compareWords } from '@/lib/crack/compareWords';
import { generateCrackField } from '@/lib/crackFieldGenerator';
import { renderLogMessage } from '@/lib/operationLog';
import { prisma } from '@/lib/prisma';
import type {
  AttemptEntry,
  CrackAttemptResult,
  CrackCompleteResult,
  CrackState,
} from '@/types/crack';

const PLACEHOLDER = '—';

interface CrackMetadata {
  failedSessionsCount: number;
  skipped: boolean;
}

// ─── Результаты сервиса (дискриминируемые юнионы для маппинга в HTTP) ──────────

export type CrackStateResult =
  | { status: 'ok'; state: CrackState }
  | { status: 'not_found' };

export type CrackAttemptOutcome =
  | { status: 'ok'; result: CrackAttemptResult }
  | { status: 'not_found' }
  | { status: 'no_session' }
  | { status: 'word_not_in_field' }
  | { status: 'conflict'; currentVersion: number };

export type CrackCompleteOutcome =
  | { status: 'ok'; result: CrackCompleteResult }
  | { status: 'not_found' }
  | { status: 'not_solved' };

export type CrackSkipOutcome =
  | { status: 'ok'; result: CrackCompleteResult }
  | { status: 'not_found' }
  | { status: 'cannot_skip' };

// ─── Хелперы ──────────────────────────────────────────────────────────────────

function isPrismaRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
  );
}

function parseWordList(raw: Prisma.JsonValue): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((item): item is string => typeof item === 'string');
}

function parseAttempts(raw: Prisma.JsonValue): AttemptEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: AttemptEntry[] = [];

  for (const item of raw) {
    if (
      typeof item === 'object' &&
      item !== null &&
      !Array.isArray(item) &&
      'word' in item &&
      'positions' in item
    ) {
      const word = (item as Record<string, unknown>).word;
      const positions = (item as Record<string, unknown>).positions;

      if (typeof word === 'string' && Array.isArray(positions)) {
        result.push(item as unknown as AttemptEntry);
      }
    }
  }

  return result;
}

function parseMetadata(raw: Prisma.JsonValue | null): CrackMetadata {
  const base: CrackMetadata = { failedSessionsCount: 0, skipped: false };

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return base;
  }

  const record = raw as Record<string, unknown>;

  if (typeof record.failedSessionsCount === 'number') {
    base.failedSessionsCount = record.failedSessionsCount;
  }

  if (typeof record.skipped === 'boolean') {
    base.skipped = record.skipped;
  }

  return base;
}

function attemptsToJson(attempts: AttemptEntry[]): Prisma.InputJsonValue {
  return attempts as unknown as Prisma.InputJsonValue;
}

// ─── GET: текущее состояние миссии ──────────────────────────────────────────────

export async function getCrackState(
  userId: string,
  slotKey: string,
): Promise<CrackStateResult> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: {
      id: true,
      missionType: true,
      isActive: true,
      crackMaxAttempts: true,
      resultPassword: true,
      targetUrl: true,
      targetEmail: true,
      hintText: true,
    },
  });

  if (!slot || !slot.isActive || slot.missionType !== 'CRACK') {
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
        resultPassword: slot.resultPassword,
        targetUrl: slot.targetUrl,
        targetEmail: slot.targetEmail,
        hintText: slot.hintText,
      },
    };
  }

  let session = await prisma.crackSession.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  if (!session) {
    const { targetWord, wordList } = generateCrackField();
    session = await prisma.crackSession.create({
      data: {
        userId,
        slotId: slot.id,
        targetWord,
        maxAttempts: slot.crackMaxAttempts ?? CRACK_DEFAULT_MAX_ATTEMPTS,
        wordList,
        attemptsUsed: 0,
        attempts: [],
      },
    });
  }

  const failedSessionsCount = parseMetadata(progress?.metadata ?? null)
    .failedSessionsCount;

  return {
    status: 'ok',
    state: {
      isActive: true,
      isCompleted: false,
      wordList: parseWordList(session.wordList),
      attemptsUsed: session.attemptsUsed,
      attempts: parseAttempts(session.attempts),
      maxAttempts: session.maxAttempts,
      failedSessionsCount,
      canSkip: failedSessionsCount >= CRACK_SKIP_THRESHOLD,
      version: session.version,
      hintText: slot.hintText,
      targetUrl: slot.targetUrl,
      targetEmail: slot.targetEmail,
    },
  };
}

// ─── POST: попытка ──────────────────────────────────────────────────────────────

export async function applyAttempt(
  userId: string,
  slotKey: string,
  word: string,
  expectedVersion: number,
): Promise<CrackAttemptOutcome> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: {
      id: true,
      missionType: true,
      isActive: true,
      targetUrl: true,
      targetEmail: true,
    },
  });

  if (!slot || !slot.isActive || slot.missionType !== 'CRACK') {
    return { status: 'not_found' };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const session = await tx.crackSession.findUnique({
        where: { userId_slotId: { userId, slotId: slot.id } },
      });

      if (!session) {
        return { status: 'no_session' };
      }

      const wordList = parseWordList(session.wordList);
      if (!wordList.includes(word)) {
        return { status: 'word_not_in_field' };
      }

      if (session.version !== expectedVersion) {
        return { status: 'conflict', currentVersion: session.version };
      }

      const positions = compareWords(session.targetWord, word);
      const isCorrect = positions.every((p) => p === 'correct');
      const attempts = parseAttempts(session.attempts);
      const nextAttempts: AttemptEntry[] = [...attempts, { word, positions }];
      const nextAttemptsUsed = session.attemptsUsed + 1;

      // Успех: фиксируем попытку, /complete сделает остальное.
      if (isCorrect) {
        const updated = await tx.crackSession.update({
          where: { id: session.id, version: expectedVersion },
          data: {
            attemptsUsed: nextAttemptsUsed,
            attempts: attemptsToJson(nextAttempts),
            version: { increment: 1 },
          },
        });

        return {
          status: 'ok',
          result: {
            isCorrect: true,
            isFailed: false,
            attemptsUsed: nextAttemptsUsed,
            positions,
            version: updated.version,
          },
        };
      }

      // Провал: попытки исчерпаны — пересоздаем поле с новым словом.
      if (nextAttemptsUsed >= session.maxAttempts) {
        const { targetWord: newTargetWord, wordList: newWordList } =
          generateCrackField();

        const updated = await tx.crackSession.update({
          where: { id: session.id, version: expectedVersion },
          data: {
            targetWord: newTargetWord,
            wordList: newWordList,
            attemptsUsed: 0,
            attempts: [],
            version: { increment: 1 },
          },
        });

        const existingProgress = await tx.missionProgress.findUnique({
          where: { userId_slotId: { userId, slotId: slot.id } },
        });
        const currentMeta = parseMetadata(existingProgress?.metadata ?? null);
        const failedSessionsCount = currentMeta.failedSessionsCount + 1;

        await tx.missionProgress.upsert({
          where: { userId_slotId: { userId, slotId: slot.id } },
          create: {
            userId,
            slotId: slot.id,
            completed: false,
            metadata: { failedSessionsCount, skipped: false },
          },
          update: {
            metadata: { failedSessionsCount, skipped: currentMeta.skipped },
            version: { increment: 1 },
          },
        });

        return {
          status: 'ok',
          result: {
            isCorrect: false,
            isFailed: true,
            attemptsUsed: 0,
            positions,
            version: updated.version,
            newWordList,
            canSkip: failedSessionsCount >= CRACK_SKIP_THRESHOLD,
          },
        };
      }

      // Обычная неудачная попытка.
      const updated = await tx.crackSession.update({
        where: { id: session.id, version: expectedVersion },
        data: {
          attemptsUsed: nextAttemptsUsed,
          attempts: attemptsToJson(nextAttempts),
          version: { increment: 1 },
        },
      });

      return {
        status: 'ok',
        result: {
          isCorrect: false,
          isFailed: false,
          attemptsUsed: nextAttemptsUsed,
          positions,
          version: updated.version,
        },
      };
    });
  } catch (error) {
    if (isPrismaRecordNotFound(error)) {
      const fresh = await prisma.crackSession.findUnique({
        where: { userId_slotId: { userId, slotId: slot.id } },
      });

      return {
        status: 'conflict',
        currentVersion: fresh?.version ?? expectedVersion,
      };
    }

    throw error;
  }
}

// ─── Общая транзакция завершения (complete/skip) ─────────────────────────────────

interface CompletionSlot {
  id: string;
  slotKey: string;
  displayName: string;
  targetUrl: string | null;
  resultPassword: string | null;
  targetEmail: string | null;
}

async function finalizeMission(
  userId: string,
  slot: CompletionSlot,
  options: { skipped: boolean },
): Promise<CrackCompleteResult> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.missionProgress.findUnique({
      where: { userId_slotId: { userId, slotId: slot.id } },
    });
    const meta = parseMetadata(existing?.metadata ?? null);

    await tx.missionProgress.upsert({
      where: { userId_slotId: { userId, slotId: slot.id } },
      create: {
        userId,
        slotId: slot.id,
        completed: true,
        completedAt: new Date(),
        metadata: {
          failedSessionsCount: meta.failedSessionsCount,
          skipped: options.skipped,
        },
      },
      update: {
        completed: true,
        completedAt: new Date(),
        metadata: {
          failedSessionsCount: meta.failedSessionsCount,
          skipped: options.skipped,
        },
        version: { increment: 1 },
      },
    });

    await tx.missionCompletionStats.create({
      data: {
        userId,
        slotId: slot.id,
        skipped: options.skipped,
        failedAttempts: meta.failedSessionsCount,
      },
    });

    await tx.crackSession.deleteMany({
      where: { userId, slotId: slot.id },
    });

    await tx.operationLog.create({
      data: {
        userId,
        type: LogType.SUCCESS,
        message: renderLogMessage('crack_access_granted', {
          targetUrl: slot.targetUrl ?? PLACEHOLDER,
          targetEmail: slot.targetEmail ?? PLACEHOLDER,
          resultPassword: slot.resultPassword ?? PLACEHOLDER,
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
      CHAT_TRIGGER_EVENTS.CRACK_COMPLETED(slot.slotKey),
    );
  });

  return {
    success: true,
    resultPassword: slot.resultPassword,
    targetUrl: slot.targetUrl,
    targetEmail: slot.targetEmail,
  };
}

// ─── POST: завершение ────────────────────────────────────────────────────────────

export async function completeCrack(
  userId: string,
  slotKey: string,
): Promise<CrackCompleteOutcome> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: {
      id: true,
      slotKey: true,
      missionType: true,
      isActive: true,
      displayName: true,
      targetUrl: true,
      targetEmail: true,
      resultPassword: true,
    },
  });

  if (!slot || !slot.isActive || slot.missionType !== 'CRACK') {
    return { status: 'not_found' };
  }

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  // Идемпотентность: повторный /complete уже пройденной миссии.
  if (progress?.completed) {
    return {
      status: 'ok',
      result: {
        success: true,
        resultPassword: slot.resultPassword,
        targetUrl: slot.targetUrl,
        targetEmail: slot.targetEmail,
      },
    };
  }

  const session = await prisma.crackSession.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  if (!session) {
    return { status: 'not_solved' };
  }

  const attempts = parseAttempts(session.attempts);
  const lastAttempt = attempts[attempts.length - 1];

  if (!lastAttempt || lastAttempt.word !== session.targetWord) {
    return { status: 'not_solved' };
  }

  const result = await finalizeMission(userId, slot, { skipped: false });
  return { status: 'ok', result };
}

// ─── POST: пропуск ───────────────────────────────────────────────────────────────

export async function skipCrack(
  userId: string,
  slotKey: string,
): Promise<CrackSkipOutcome> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: {
      id: true,
      slotKey: true,
      missionType: true,
      isActive: true,
      displayName: true,
      targetUrl: true,
      targetEmail: true,
      resultPassword: true,
    },
  });

  if (!slot || !slot.isActive || slot.missionType !== 'CRACK') {
    return { status: 'not_found' };
  }

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  // Идемпотентность: повторный /skip уже пройденной миссии.
  if (progress?.completed) {
    return {
      status: 'ok',
      result: {
        success: true,
        resultPassword: slot.resultPassword,
        targetUrl: slot.targetUrl,
        targetEmail: slot.targetEmail,
      },
    };
  }

  const failedSessionsCount = parseMetadata(progress?.metadata ?? null)
    .failedSessionsCount;

  if (failedSessionsCount < CRACK_SKIP_THRESHOLD) {
    return { status: 'cannot_skip' };
  }

  const result = await finalizeMission(userId, slot, { skipped: true });
  return { status: 'ok', result };
}
