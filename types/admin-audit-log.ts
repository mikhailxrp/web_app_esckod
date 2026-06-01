import type { Prisma } from '@prisma/client';

export interface AuditLogItem {
  id: string;
  type: string;
  userId: string | null;
  userEmail: string | null;
  adminId: string | null;
  adminEmail: string | null;
  message: string;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
}
