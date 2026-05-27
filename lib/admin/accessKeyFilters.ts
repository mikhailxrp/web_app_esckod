import type { Prisma } from '@prisma/client';
import type { ExportQuery, ListKeysQuery } from '@/lib/validations/admin-keys';

type AccessKeyFilterParams = Pick<ListKeysQuery, 'q' | 'status' | 'activations'>;

export function buildAccessKeysWhere(
  params: AccessKeyFilterParams,
): Prisma.AccessKeyWhereInput {
  const { q, status, activations } = params;

  return {
    ...(q && {
      OR: [
        { key: { contains: q, mode: 'insensitive' as const } },
        {
          users: {
            some: { email: { contains: q, mode: 'insensitive' as const } },
          },
        },
      ],
    }),
    ...(status === 'active' && { isBlocked: false }),
    ...(status === 'blocked' && { isBlocked: true }),
    ...(activations === 'lt5' && { currentActivations: { lt: 5 } }),
    ...(activations === 'eq5' && { currentActivations: { equals: 5 } }),
    ...(activations === 'gt5' && { currentActivations: { gt: 5 } }),
  };
}

export function buildWhereFromExportQuery(
  status: ExportQuery['status'],
  activations: ExportQuery['activations'],
): Prisma.AccessKeyWhereInput {
  return buildAccessKeysWhere({ status, activations });
}
