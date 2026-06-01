import { prisma } from '@/lib/prisma';
import { AuditLogTable } from '@/components/admin/audit-log/AuditLogTable';
import type { AuditLogItem } from '@/types/admin-audit-log';

export const metadata = {
  title: 'Аудит-лог',
};

const INITIAL_LIMIT = 50;

export default async function AuditLogPage(): Promise<React.ReactElement> {
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: INITIAL_LIMIT + 1,
  });

  let initialNextCursor: string | null = null;
  if (rows.length > INITIAL_LIMIT) {
    initialNextCursor = rows[INITIAL_LIMIT].id;
    rows.splice(INITIAL_LIMIT);
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

  const initialLogs: AuditLogItem[] = rows.map((r) => ({
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

  return (
    <div>
      <AuditLogTable
        initialLogs={initialLogs}
        initialNextCursor={initialNextCursor}
      />
    </div>
  );
}
