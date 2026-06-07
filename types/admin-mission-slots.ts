import type { MissionType } from '@prisma/client';

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
