import { prisma } from '@/lib/prisma';
import { UsersTable } from '@/components/admin/users/UsersTable';

const LIMIT = 20;

export const metadata = {
  title: 'Управление пользователями',
};

export default async function UsersPage(): Promise<React.ReactElement> {
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      take: LIMIT,
      skip: 0,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        isBlocked: true,
        createdAt: true,
        accessKey: { select: { key: true } },
      },
    }),
    prisma.user.count(),
  ]);

  const serialized = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <UsersTable
      initialData={serialized}
      initialTotal={total}
      initialTotalPages={Math.ceil(total / LIMIT)}
    />
  );
}
