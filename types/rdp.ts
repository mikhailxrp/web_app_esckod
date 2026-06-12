import type { PuzzleField } from '@/lib/rdp/types';

export type RdpScenario = 1 | 2;

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
