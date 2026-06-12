import { z } from 'zod';

export const ALLOWED_PDF_MIME = ['application/pdf'] as const;
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png'] as const;
export const ALLOWED_RDP_MIME = [...ALLOWED_PDF_MIME, ...ALLOWED_IMAGE_MIME] as const;

export type AllowedRdpMime = (typeof ALLOWED_RDP_MIME)[number];

export const MAX_RDP_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** @deprecated используй MAX_RDP_FILE_SIZE_BYTES */
export const MAX_PDF_SIZE_BYTES = MAX_RDP_FILE_SIZE_BYTES;

export function normalizeFilename(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

export function buildRdpFileKey(slotKey: string, folder: string, name: string): string {
  return `files/rdp/${slotKey}/${folder}/${name}`;
}

export const fileUploadFieldsSchema = z.object({
  slotId: z.string().cuid(),
  folder: z.string().min(1),
  name: z.string().min(1).optional(),
});

export const folderLockSchema = z.object({
  slotId: z.string().cuid(),
  folder: z.string().min(1),
  isLocked: z.boolean(),
});

export const folderDeleteSchema = z.object({
  slotId: z.string().cuid(),
  folder: z.string().min(1),
});

export const fileRenameSchema = z.object({
  name: z.string().min(1).max(255),
});

export type FileUploadFields = z.infer<typeof fileUploadFieldsSchema>;
export type FolderLockInput = z.infer<typeof folderLockSchema>;
export type FolderDeleteInput = z.infer<typeof folderDeleteSchema>;
export type FileRenameInput = z.infer<typeof fileRenameSchema>;
