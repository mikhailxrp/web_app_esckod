import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { querySchema } from '@/lib/validations/admin-audit-log';
import type { AuditLogItem } from '@/types/admin-audit-log';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { type, userId, adminId, fromDate, toDate, limit, cursor } = parsed.data;

  const where: Prisma.AdminAuditLogWhereInput = {
    ...(type && { type }),
    ...(userId && { userId }),
    ...(adminId && { adminId }),
    ...((fromDate || toDate) && {
      createdAt: {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      },
    }),
  };

  const rows = await prisma.adminAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    nextCursor = rows[limit].id;
    rows.splice(limit);
  }

  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
  const adminIds = [...new Set(rows.map((r) => r.adminId).filter(Boolean))] as string[];

  const [users, admins] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    }),
    prisma.adminUser.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, email: true },
    }),
  ]);

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.email]));
  const adminMap = Object.fromEntries(admins.map((a) => [a.id, a.email]));

  const logs: AuditLogItem[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    userId: r.userId,
    userEmail: r.userId ? (userMap[r.userId] ?? '<deleted>') : null,
    adminId: r.adminId,
    adminEmail: r.adminId ? (adminMap[r.adminId] ?? '<deleted>') : null,
    message: r.message,
    metadata: r.metadata,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({ logs, nextCursor });
}
