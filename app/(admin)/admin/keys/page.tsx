import { prisma } from '@/lib/prisma';
import { buildAccessKeysWhere } from '@/lib/admin/accessKeyFilters';
import { KeysTable } from '@/components/admin/keys/KeysTable';

const LIMIT = 14;

export const metadata = {
  title: 'Управление ключами доступа',
};

export default async function KeysPage(): Promise<React.ReactElement> {
  const where = buildAccessKeysWhere({ status: 'all', activations: [], limitChanged: undefined });

  const [keys, total] = await prisma.$transaction([
    prisma.accessKey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: LIMIT,
      select: {
        id: true,
        key: true,
        isBlocked: true,
        blockedAt: true,
        maxActivations: true,
        currentActivations: true,
        createdAt: true,
      },
    }),
    prisma.accessKey.count({ where }),
  ]);

  const totalPages = Math.ceil(total / LIMIT);

  const serialized = keys.map((k) => ({
    ...k,
    blockedAt: k.blockedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));

  return (
    <KeysTable
      initialData={serialized}
      initialTotal={total}
      initialTotalPages={totalPages}
    />
  );
}
