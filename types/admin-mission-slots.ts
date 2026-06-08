import type { CipherType, MissionType } from '@prisma/client';

export interface MissionSlotListItem {
  id: string;
  slotKey: string;
  missionType: MissionType;
  displayName: string;
  orderIndex: number;
  isActive: boolean;
  completionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MissionSlotDetail {
  id: string;
  slotKey: string;
  missionType: MissionType;
  displayName: string;
  orderIndex: number;
  isActive: boolean;
  hintText: string | null;
  // CRACK
  targetUrl: string | null;
  targetEmail: string | null;
  resultPassword: string | null;
  crackMaxAttempts: number | null;
  // DECIPHER
  cipherType: CipherType | null;
  encryptedWord: string | null;
  cipherKey: string | null;
  folderPassword: string | null;
  folderPath: string | null;
  unlocksRdpFolder: string | null;
  unlocksRdpSlotKey: string | null;
  // RDP
  correctIp: string | null;
  rdpScenario: number | null;
  timerSeconds: number | null;
  rdpPuzzleGridSize: number | null;
  logSubjectName: string | null;
  nextRdpSlotKey: string | null;
  // Meta
  completionsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveRdpSlot {
  slotKey: string;
  displayName: string;
}
