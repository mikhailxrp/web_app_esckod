export interface RdpFileItem {
  id: string;
  name: string;
  url: string;
  folder: string;
  isLocked: boolean;
  createdAt: string;
}

export interface RdpSlotData {
  id: string;
  name: string;
  slotKey: string;
  files: RdpFileItem[];
}

export interface RdpFolderGroup {
  folder: string;
  isLocked: boolean;
  files: RdpFileItem[];
}

// Key: `"${slotKey}::${folder}"` → password from linked Decipher slot (null if not configured)
export type FolderPasswordMap = Record<string, string | null>;
