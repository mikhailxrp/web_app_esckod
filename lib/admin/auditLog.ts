import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

interface WriteAuditLogParams {
  userId?: string;
  adminId?: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}

export async function writeAuditLog(
  type: string,
  params: WriteAuditLogParams,
): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      type,
      userId: params.userId ?? null,
      adminId: params.adminId ?? null,
      message: params.message,
      metadata: params.metadata ?? undefined,
    },
  });
}
