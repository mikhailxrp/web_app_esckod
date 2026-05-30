import { prisma } from '@/lib/prisma';
import { AdminsTable } from '@/components/admin/admins/AdminsTable';

export const metadata = {
  title: 'Управление администраторами',
};

export default async function AdminsPage(): Promise<React.ReactElement> {
  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  const serialized = admins.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
  }));

  return <AdminsTable admins={serialized} />;
}
