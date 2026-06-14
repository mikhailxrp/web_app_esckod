import type { PuzzleField } from '@/lib/rdp/types';

export type RdpScenario = 1 | 2;

// ─── RDP Files / Unlock ──────────────────────────────────────────────────────

export interface RdpFileView {
  id: string;
  name: string;
  url: string | null;
  size: number | null;
}

export interface RdpFolderView {
  folderName: string;
  isLocked: boolean;
  isUnlocked: boolean;
  folderPath?: string;
  files: RdpFileView[];
}

export interface RdpFilesResult {
  folders: RdpFolderView[];
  version: number;
  triggerActivated: boolean;
  completed: boolean;
}

export interface RdpUnlockResult {
  success: true;
  folderName: string;
  version: number;
}

export interface RdpConnectResult {
  slotKey: string;
  displayName: string;
  rdpScenario: RdpScenario;
  isCompleted: boolean;
  logSubjectName: string;
  hintText: string | null;
}

export interface RdpPuzzleState {
  puzzleField: PuzzleField;
  version: number;
  timerSeconds?: number;
  timerStartedAt?: string;
  timerRemaining?: number;
}

export interface RdpRotateResult {
  puzzleField: PuzzleField;
  version: number;
}

export interface RdpCheckPuzzleResult {
  isSolved: boolean;
  version: number;
}

export interface RdpTimerExpiredResult {
  newPuzzleField: PuzzleField;
  timerStartedAt: string;
  timerSeconds: number;
  canSkip: boolean;
  version: number;
}

export interface RdpSkipResult {
  success: true;
}

// ─── RDP File Viewed / Complete ──────────────────────────────────────────────

export type RdpScenarioFinal = 'session_lost' | 'session_terminated';

export interface RdpFileViewedResult {
  triggered: boolean;
  alreadyTriggered?: boolean;
  scenarioFinal?: RdpScenarioFinal;
  version: number;
}

export interface RdpCompleteResult {
  success: true;
  version: number;
}
