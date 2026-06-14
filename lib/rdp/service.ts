import 'server-only';

import { LogType, Prisma } from '@prisma/client';

import { CHAT_TRIGGER_EVENTS } from '@/constants/chatTriggerEvents';
import { advanceTriggerListeners } from '@/lib/chat/triggers';
import { renderLogMessage } from '@/lib/operationLog';
import { prisma } from '@/lib/prisma';
import { generateField } from '@/lib/rdp/pipesPuzzleGenerator';
import { checkSolution } from '@/lib/rdp/pipesSolver';
import type { PuzzleField, Scenario, TileRotation } from '@/lib/rdp/types';
import type { RdpFolderView } from '@/types/rdp';

// ─── Metadata ───────────────────────────────────────────────────────────────

interface RdpMetadata {
  puzzleField?: PuzzleField;
  puzzleSolved: boolean;
  timerStartedAt?: string;
  timerExpiredCount: number;
  skipped: boolean;
  triggerActivated: boolean;
  viewedFileIds: string[];
  unlockedFolders: string[];
}

function parseMetadata(raw: Prisma.JsonValue | null): RdpMetadata {
  const base: RdpMetadata = {
    puzzleSolved: false,
    timerExpiredCount: 0,
    skipped: false,
    triggerActivated: false,
    viewedFileIds: [],
    unlockedFolders: [],
  };

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return base;
  }

  const r = raw as Record<string, unknown>;

  if (typeof r.puzzleSolved === 'boolean') base.puzzleSolved = r.puzzleSolved;
  if (typeof r.timerExpiredCount === 'number') base.timerExpiredCount = r.timerExpiredCount;
  if (typeof r.skipped === 'boolean') base.skipped = r.skipped;
  if (typeof r.triggerActivated === 'boolean') base.triggerActivated = r.triggerActivated;
  if (typeof r.timerStartedAt === 'string') base.timerStartedAt = r.timerStartedAt;

  if (
    typeof r.puzzleField === 'object' &&
    r.puzzleField !== null &&
    !Array.isArray(r.puzzleField)
  ) {
    base.puzzleField = r.puzzleField as PuzzleField;
  }

  if (Array.isArray(r.viewedFileIds) && r.viewedFileIds.every((v) => typeof v === 'string')) {
    base.viewedFileIds = r.viewedFileIds as string[];
  }

  if (Array.isArray(r.unlockedFolders) && r.unlockedFolders.every((v) => typeof v === 'string')) {
    base.unlockedFolders = r.unlockedFolders as string[];
  }

  return base;
}

function metadataToJson(meta: RdpMetadata): Prisma.InputJsonValue {
  return meta as unknown as Prisma.InputJsonValue;
}

// ─── Slot helpers ────────────────────────────────────────────────────────────

const SLOT_SELECT = {
  id: true,
  slotKey: true,
  missionType: true,
  isActive: true,
  displayName: true,
  correctIp: true,
  rdpScenario: true,
  rdpPuzzleGridSize: true,
  timerSeconds: true,
  logSubjectName: true,
  hintText: true,
} as const;

type RdpSlotRow = {
  id: string;
  slotKey: string;
  missionType: string;
  isActive: boolean;
  displayName: string;
  correctIp: string | null;
  rdpScenario: number | null;
  rdpPuzzleGridSize: number | null;
  timerSeconds: number | null;
  logSubjectName: string | null;
  hintText: string | null;
};

function isValidRdpSlot(slot: RdpSlotRow | null): slot is RdpSlotRow & {
  correctIp: string;
  rdpScenario: number;
  rdpPuzzleGridSize: number;
} {
  return (
    slot !== null &&
    slot.isActive &&
    slot.missionType === 'RDP' &&
    slot.correctIp !== null &&
    slot.rdpScenario !== null &&
    slot.rdpPuzzleGridSize !== null
  );
}

function isPrismaRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
  );
}

// ─── Outcome types ───────────────────────────────────────────────────────────

export type RdpConnectOutcome =
  | {
      type: 'SUCCESS';
      slotKey: string;
      displayName: string;
      rdpScenario: number;
      isCompleted: boolean;
      logSubjectName: string | null;
      hintText: string | null;
    }
  | { type: 'INVALID_IP' };

export type RdpPuzzleStateOutcome =
  | {
      type: 'SUCCESS';
      puzzleField: PuzzleField;
      version: number;
      timerSeconds?: number;
      timerStartedAt?: string;
      timerRemaining?: number;
    }
  | { type: 'SLOT_NOT_FOUND' };

export type RdpRotateTileOutcome =
  | { type: 'SUCCESS'; puzzleField: PuzzleField; version: number }
  | { type: 'SLOT_NOT_FOUND' }
  | { type: 'NO_PROGRESS' }
  | { type: 'TILE_NOT_FOUND' }
  | { type: 'CONFLICT'; currentVersion: number };

export type RdpCheckPuzzleOutcome =
  | { type: 'SUCCESS'; isSolved: boolean; version: number }
  | { type: 'SLOT_NOT_FOUND' }
  | { type: 'NO_PROGRESS' }
  | { type: 'CONFLICT'; currentVersion: number };

export type RdpTimerExpiredOutcome =
  | {
      type: 'SUCCESS';
      newPuzzleField: PuzzleField;
      timerStartedAt: string;
      timerSeconds: number;
      canSkip: boolean;
      version: number;
    }
  | { type: 'SLOT_NOT_FOUND' }
  | { type: 'NO_PROGRESS' }
  | { type: 'NOT_SCENARIO_2' }
  | { type: 'TIMER_NOT_EXPIRED' }
  | { type: 'CONFLICT'; currentVersion: number };

export type RdpSkipOutcome =
  | { type: 'SUCCESS' }
  | { type: 'SLOT_NOT_FOUND' }
  | { type: 'SKIP_NOT_ALLOWED_SCENARIO_1' }
  | { type: 'CANNOT_SKIP' };

export type RdpFilesOutcome =
  | {
      type: 'SUCCESS';
      folders: RdpFolderView[];
      version: number;
      triggerActivated: boolean;
      completed: boolean;
    }
  | { type: 'SLOT_NOT_FOUND' }
  | { type: 'PUZZLE_NOT_SOLVED' };

export type RdpUnlockOutcome =
  | { type: 'SUCCESS'; folderName: string; version: number }
  | { type: 'SLOT_NOT_FOUND' }
  | { type: 'PUZZLE_NOT_SOLVED' }
  | { type: 'FOLDER_NOT_FOUND' }
  | { type: 'FOLDER_NOT_LOCKED' }
  | { type: 'INVALID_PASSWORD' }
  | { type: 'CONFLICT'; currentVersion: number };

// ─── getFiles ────────────────────────────────────────────────────────────────

export async function getFiles(
  userId: string,
  slotKey: string,
): Promise<RdpFilesOutcome> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: { id: true, missionType: true, isActive: true },
  });

  if (!slot || !slot.isActive || slot.missionType !== 'RDP') {
    return { type: 'SLOT_NOT_FOUND' };
  }

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  const meta = parseMetadata(progress?.metadata ?? null);

  if (!progress || !meta.puzzleSolved) {
    return { type: 'PUZZLE_NOT_SOLVED' };
  }

  const [files, decipherSlots] = await Promise.all([
    prisma.rdpFile.findMany({
      where: { slotId: slot.id },
      select: { id: true, name: true, url: true, size: true, folder: true, isLocked: true },
      orderBy: [{ folder: 'asc' }, { name: 'asc' }],
    }),
    prisma.missionSlot.findMany({
      where: { unlocksRdpSlotKey: slotKey, missionType: 'DECIPHER', isActive: true },
      select: { unlocksRdpFolder: true, folderPath: true },
    }),
  ]);

  const folderPathMap = new Map<string, string>();

  for (const ds of decipherSlots) {
    if (ds.unlocksRdpFolder && ds.folderPath) {
      folderPathMap.set(ds.unlocksRdpFolder, ds.folderPath);
    }
  }

  const folderMap = new Map<
    string,
    { isLocked: boolean; files: { id: string; name: string; url: string | null; size: number | null }[] }
  >();

  for (const file of files) {
    if (!folderMap.has(file.folder)) {
      folderMap.set(file.folder, { isLocked: file.isLocked, files: [] });
    }

    const folder = folderMap.get(file.folder)!;
    const isUnlocked = meta.unlockedFolders.includes(file.folder);

    folder.files.push({
      id: file.id,
      name: file.name,
      url: file.isLocked && !isUnlocked ? null : file.url,
      size: file.size,
    });
  }

  const folders: RdpFolderView[] = [];

  for (const [folderName, folderData] of folderMap) {
    const isUnlocked = meta.unlockedFolders.includes(folderName);
    const entry: RdpFolderView = {
      folderName,
      isLocked: folderData.isLocked,
      isUnlocked,
      files: folderData.files,
    };

    if (folderData.isLocked) {
      const folderPath = folderPathMap.get(folderName);

      if (folderPath) {
        entry.folderPath = folderPath;
      }
    }

    folders.push(entry);
  }

  return {
    type: 'SUCCESS',
    folders,
    version: progress.version,
    triggerActivated: meta.triggerActivated,
    completed: progress.completed,
  };
}

// ─── unlockFolder ─────────────────────────────────────────────────────────────

export async function unlockFolder(
  userId: string,
  slotKey: string,
  folderName: string,
  password: string,
  expectedVersion: number,
): Promise<RdpUnlockOutcome> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: { id: true, missionType: true, isActive: true, logSubjectName: true },
  });

  if (!slot || !slot.isActive || slot.missionType !== 'RDP') {
    return { type: 'SLOT_NOT_FOUND' };
  }

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  const meta = parseMetadata(progress?.metadata ?? null);

  if (!progress || !meta.puzzleSolved) {
    return { type: 'PUZZLE_NOT_SOLVED' };
  }

  const folderFile = await prisma.rdpFile.findFirst({
    where: { slotId: slot.id, folder: folderName },
    select: { isLocked: true },
  });

  if (!folderFile) {
    return { type: 'FOLDER_NOT_FOUND' };
  }

  if (!folderFile.isLocked) {
    return { type: 'FOLDER_NOT_LOCKED' };
  }

  const decipherSlot = await prisma.missionSlot.findFirst({
    where: {
      folderPassword: password,
      unlocksRdpFolder: folderName,
      unlocksRdpSlotKey: slotKey,
      missionType: 'DECIPHER',
      isActive: true,
    },
    select: { folderPath: true },
  });

  if (!decipherSlot) {
    return { type: 'INVALID_PASSWORD' };
  }

  if (progress.version !== expectedVersion) {
    return { type: 'CONFLICT', currentVersion: progress.version };
  }

  const logMessage = renderLogMessage('rdp_folder_unlocked', {
    folderPath: decipherSlot.folderPath ?? '—',
    logSubjectName: slot.logSubjectName ?? '—',
    folderPassword: password,
  });

  const alreadyUnlocked = meta.unlockedFolders.includes(folderName);

  if (alreadyUnlocked) {
    await prisma.operationLog.create({
      data: { userId, type: LogType.SUCCESS, message: logMessage },
    });

    return { type: 'SUCCESS', folderName, version: progress.version };
  }

  const updatedMeta: RdpMetadata = {
    ...meta,
    unlockedFolders: [...meta.unlockedFolders, folderName],
  };

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.missionProgress.update({
        where: { id: progress.id, version: expectedVersion },
        data: {
          metadata: metadataToJson(updatedMeta),
          version: { increment: 1 },
        },
      });

      await tx.operationLog.create({
        data: { userId, type: LogType.SUCCESS, message: logMessage },
      });

      return record;
    });

    return { type: 'SUCCESS', folderName, version: updated.version };
  } catch (error) {
    if (isPrismaRecordNotFound(error)) {
      const fresh = await prisma.missionProgress.findUnique({
        where: { id: progress.id },
        select: { version: true },
      });

      return { type: 'CONFLICT', currentVersion: fresh?.version ?? expectedVersion };
    }

    throw error;
  }
}

// ─── handleConnect ───────────────────────────────────────────────────────────

export async function handleConnect(
  userId: string,
  ip: string,
): Promise<RdpConnectOutcome> {
  const slot = await prisma.missionSlot.findFirst({
    where: { correctIp: ip, missionType: 'RDP', isActive: true },
    select: SLOT_SELECT,
  });

  if (!slot) {
    await prisma.operationLog.create({
      data: {
        userId,
        type: LogType.ERROR,
        message: renderLogMessage('rdp_invalid_ip', { ip }),
      },
    });

    return { type: 'INVALID_IP' };
  }

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
    select: { completed: true },
  });

  return {
    type: 'SUCCESS',
    slotKey: slot.slotKey,
    displayName: slot.displayName,
    rdpScenario: slot.rdpScenario ?? 1,
    isCompleted: progress?.completed ?? false,
    logSubjectName: slot.logSubjectName,
    hintText: slot.hintText,
  };
}

// ─── getOrCreatePuzzleState ──────────────────────────────────────────────────

export async function getOrCreatePuzzleState(
  userId: string,
  slotKey: string,
): Promise<RdpPuzzleStateOutcome> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: SLOT_SELECT,
  });

  if (!isValidRdpSlot(slot)) {
    return { type: 'SLOT_NOT_FOUND' };
  }

  const scenario = slot.rdpScenario as Scenario;
  const gridSize = slot.rdpPuzzleGridSize;

  const existing = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  if (existing) {
    const meta = parseMetadata(existing.metadata ?? null);

    if (meta.puzzleField) {
      if (scenario === 2 && meta.timerStartedAt && slot.timerSeconds) {
        const elapsed = Date.now() - new Date(meta.timerStartedAt).getTime();
        const timerRemaining = Math.round(
          Math.max(0, slot.timerSeconds * 1000 - elapsed) / 1000,
        );

        return {
          type: 'SUCCESS',
          puzzleField: meta.puzzleField,
          version: existing.version,
          timerSeconds: slot.timerSeconds,
          timerStartedAt: meta.timerStartedAt,
          timerRemaining,
        };
      }

      return {
        type: 'SUCCESS',
        puzzleField: meta.puzzleField,
        version: existing.version,
      };
    }
  }

  const puzzleField = generateField(gridSize, scenario);
  const timerStartedAt = scenario === 2 ? new Date().toISOString() : undefined;

  const newMeta: RdpMetadata = {
    puzzleField,
    puzzleSolved: false,
    timerExpiredCount: 0,
    skipped: false,
    triggerActivated: false,
    viewedFileIds: [],
    unlockedFolders: [],
    ...(timerStartedAt && { timerStartedAt }),
  };

  const record = await prisma.missionProgress.upsert({
    where: { userId_slotId: { userId, slotId: slot.id } },
    create: {
      userId,
      slotId: slot.id,
      completed: false,
      metadata: metadataToJson(newMeta),
    },
    update: {
      metadata: metadataToJson(newMeta),
      version: { increment: 1 },
    },
  });

  if (scenario === 2 && timerStartedAt && slot.timerSeconds) {
    return {
      type: 'SUCCESS',
      puzzleField,
      version: record.version,
      timerSeconds: slot.timerSeconds,
      timerStartedAt,
      timerRemaining: slot.timerSeconds,
    };
  }

  return {
    type: 'SUCCESS',
    puzzleField,
    version: record.version,
  };
}

// ─── rotateTile ──────────────────────────────────────────────────────────────

const ROTATION_CYCLE: Record<TileRotation, TileRotation> = {
  0: 90,
  90: 180,
  180: 270,
  270: 0,
};

export async function rotateTile(
  userId: string,
  slotKey: string,
  tileId: string,
  expectedVersion: number,
): Promise<RdpRotateTileOutcome> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: { id: true, missionType: true, isActive: true },
  });

  if (!slot || !slot.isActive || slot.missionType !== 'RDP') {
    return { type: 'SLOT_NOT_FOUND' };
  }

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  if (!progress) {
    return { type: 'NO_PROGRESS' };
  }

  if (progress.version !== expectedVersion) {
    return { type: 'CONFLICT', currentVersion: progress.version };
  }

  const meta = parseMetadata(progress.metadata ?? null);

  if (!meta.puzzleField) {
    return { type: 'NO_PROGRESS' };
  }

  const tileIndex = meta.puzzleField.tiles.findIndex((t) => t.id === tileId);

  if (tileIndex === -1) {
    return { type: 'TILE_NOT_FOUND' };
  }

  const tile = meta.puzzleField.tiles[tileIndex];

  const updatedTiles = meta.puzzleField.tiles.map((t, i) =>
    i === tileIndex
      ? { ...t, rotation: ROTATION_CYCLE[t.rotation] }
      : t,
  );

  const updatedField: PuzzleField = {
    ...meta.puzzleField,
    tiles: updatedTiles,
  };

  const updatedMeta: RdpMetadata = { ...meta, puzzleField: updatedField };

  try {
    const updated = await prisma.missionProgress.update({
      where: { id: progress.id, version: expectedVersion },
      data: {
        metadata: metadataToJson(updatedMeta),
        version: { increment: 1 },
      },
    });

    return { type: 'SUCCESS', puzzleField: updatedField, version: updated.version };
  } catch (error) {
    if (isPrismaRecordNotFound(error)) {
      const fresh = await prisma.missionProgress.findUnique({
        where: { id: progress.id },
        select: { version: true },
      });

      return { type: 'CONFLICT', currentVersion: fresh?.version ?? expectedVersion };
    }

    throw error;
  }
}

// ─── checkPuzzle ─────────────────────────────────────────────────────────────

export async function checkPuzzle(
  userId: string,
  slotKey: string,
  expectedVersion: number,
): Promise<RdpCheckPuzzleOutcome> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: { id: true, missionType: true, isActive: true, logSubjectName: true },
  });

  if (!slot || !slot.isActive || slot.missionType !== 'RDP') {
    return { type: 'SLOT_NOT_FOUND' };
  }

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  if (!progress) {
    return { type: 'NO_PROGRESS' };
  }

  if (progress.version !== expectedVersion) {
    return { type: 'CONFLICT', currentVersion: progress.version };
  }

  const meta = parseMetadata(progress.metadata ?? null);

  if (!meta.puzzleField) {
    return { type: 'NO_PROGRESS' };
  }

  if (meta.puzzleSolved) {
    return { type: 'SUCCESS', isSolved: true, version: progress.version };
  }

  const isSolved = checkSolution(meta.puzzleField);

  if (!isSolved) {
    return { type: 'SUCCESS', isSolved: false, version: progress.version };
  }

  const updatedMeta: RdpMetadata = { ...meta, puzzleSolved: true };

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.missionProgress.update({
        where: { id: progress.id, version: expectedVersion },
        data: {
          metadata: metadataToJson(updatedMeta),
          version: { increment: 1 },
        },
      });

      await tx.operationLog.create({
        data: {
          userId,
          type: LogType.SUCCESS,
          message: renderLogMessage('rdp_puzzle_solved', {
            logSubjectName: slot.logSubjectName ?? '—',
          }),
        },
      });

      return record;
    });

    return { type: 'SUCCESS', isSolved: true, version: updated.version };
  } catch (error) {
    if (isPrismaRecordNotFound(error)) {
      const fresh = await prisma.missionProgress.findUnique({
        where: { id: progress.id },
        select: { version: true },
      });

      return { type: 'CONFLICT', currentVersion: fresh?.version ?? expectedVersion };
    }

    throw error;
  }
}

// ─── handleTimerExpired ──────────────────────────────────────────────────────

export async function handleTimerExpired(
  userId: string,
  slotKey: string,
  expectedVersion: number,
): Promise<RdpTimerExpiredOutcome> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: SLOT_SELECT,
  });

  if (!isValidRdpSlot(slot)) {
    return { type: 'SLOT_NOT_FOUND' };
  }

  if (slot.rdpScenario !== 2) {
    return { type: 'NOT_SCENARIO_2' };
  }

  if (!slot.timerSeconds) {
    return { type: 'NOT_SCENARIO_2' };
  }

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  if (!progress) {
    return { type: 'NO_PROGRESS' };
  }

  if (progress.version !== expectedVersion) {
    return { type: 'CONFLICT', currentVersion: progress.version };
  }

  const meta = parseMetadata(progress.metadata ?? null);

  if (!meta.timerStartedAt) {
    return { type: 'TIMER_NOT_EXPIRED' };
  }

  const elapsed = Date.now() - new Date(meta.timerStartedAt).getTime();
  const threshold = (slot.timerSeconds - 1) * 1000;

  if (elapsed < threshold) {
    return { type: 'TIMER_NOT_EXPIRED' };
  }

  const newPuzzleField = generateField(slot.rdpPuzzleGridSize, 2);
  const newTimerStartedAt = new Date().toISOString();
  const newTimerExpiredCount = meta.timerExpiredCount + 1;
  const canSkip = newTimerExpiredCount >= 2;

  const updatedMeta: RdpMetadata = {
    ...meta,
    puzzleField: newPuzzleField,
    timerStartedAt: newTimerStartedAt,
    timerExpiredCount: newTimerExpiredCount,
  };

  try {
    const updated = await prisma.missionProgress.update({
      where: { id: progress.id, version: expectedVersion },
      data: {
        metadata: metadataToJson(updatedMeta),
        version: { increment: 1 },
      },
    });

    return {
      type: 'SUCCESS',
      newPuzzleField,
      timerStartedAt: newTimerStartedAt,
      timerSeconds: slot.timerSeconds,
      canSkip,
      version: updated.version,
    };
  } catch (error) {
    if (isPrismaRecordNotFound(error)) {
      const fresh = await prisma.missionProgress.findUnique({
        where: { id: progress.id },
        select: { version: true },
      });

      return { type: 'CONFLICT', currentVersion: fresh?.version ?? expectedVersion };
    }

    throw error;
  }
}

// ─── handleSkip ──────────────────────────────────────────────────────────────

export async function handleSkip(
  userId: string,
  slotKey: string,
): Promise<RdpSkipOutcome> {
  const slot = await prisma.missionSlot.findUnique({
    where: { slotKey },
    select: {
      ...SLOT_SELECT,
      displayName: true,
    },
  });

  if (!isValidRdpSlot(slot)) {
    return { type: 'SLOT_NOT_FOUND' };
  }

  if (slot.rdpScenario !== 2) {
    return { type: 'SKIP_NOT_ALLOWED_SCENARIO_1' };
  }

  const progress = await prisma.missionProgress.findUnique({
    where: { userId_slotId: { userId, slotId: slot.id } },
  });

  const meta = parseMetadata(progress?.metadata ?? null);

  if (progress?.completed) {
    return { type: 'SUCCESS' };
  }

  if (!progress || meta.timerExpiredCount < 2) {
    return { type: 'CANNOT_SKIP' };
  }

  const updatedMeta: RdpMetadata = {
    ...meta,
    skipped: true,
    triggerActivated: true,
  };

  await prisma.$transaction(async (tx) => {
    await tx.missionProgress.update({
      where: { userId_slotId: { userId, slotId: slot.id } },
      data: {
        completed: true,
        completedAt: new Date(),
        metadata: metadataToJson(updatedMeta),
        version: { increment: 1 },
      },
    });

    await tx.gameProgress.upsert({
      where: { userId },
      create: { userId, marinaTriggered: true },
      update: { marinaTriggered: true, version: { increment: 1 } },
    });

    await tx.operationLog.create({
      data: {
        userId,
        type: LogType.SUCCESS,
        message: renderLogMessage('rdp_completed', {}),
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
      CHAT_TRIGGER_EVENTS.RDP_COMPLETED(slot.slotKey),
    );

    await advanceTriggerListeners(
      tx,
      userId,
      CHAT_TRIGGER_EVENTS.RDP_MARINA_TRIGGERED,
    );
  });

  return { type: 'SUCCESS' };
}
