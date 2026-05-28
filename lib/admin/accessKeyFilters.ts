import type { Prisma } from '@prisma/client';
import type { ExportQuery, ListKeysQuery } from '@/lib/validations/admin-keys';
import type {
  ActivationsExportFilter,
  ActivationsFilterValue,
} from '@/types/admin-keys';

const DEFAULT_MAX_ACTIVATIONS = 5;

type AccessKeyFilterParams = Pick<
  ListKeysQuery,
  'q' | 'status' | 'activations' | 'limitChanged'
>;

function buildActivationsCondition(
  activations: ActivationsFilterValue[],
): Prisma.AccessKeyWhereInput | null {
  if (activations.length === 0) return null;

  const conditions = activations.map((v): Prisma.AccessKeyWhereInput => {
    if (v === 'gt5') return { currentActivations: { gt: 5 } };
    const count = Number(v.replace('eq', ''));
    return { currentActivations: { equals: count } };
  });

  return conditions.length === 1 ? conditions[0] : { OR: conditions };
}

export function buildAccessKeysWhere(
  params: AccessKeyFilterParams,
): Prisma.AccessKeyWhereInput {
  const { q, status, activations, limitChanged } = params;

  const activationsCondition = buildActivationsCondition(activations);

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
    ...(activationsCondition ?? {}),
    ...(limitChanged === true && {
      maxActivations: { not: DEFAULT_MAX_ACTIVATIONS },
    }),
  };
}

export function buildWhereFromExportQuery(
  status: ExportQuery['status'],
  activations: ActivationsFilterValue[],
  limitChanged: ExportQuery['limitChanged'],
): Prisma.AccessKeyWhereInput {
  return buildAccessKeysWhere({ status, activations, limitChanged });
}

type KeyForActivationsFilter = {
  currentActivations: number;
  maxActivations: number;
};

export function filterByActivationsExport<T extends KeyForActivationsFilter>(
  keys: T[],
  filter: ActivationsExportFilter,
): T[] {
  if (filter === 'all') return keys;

  return keys.filter((k) => {
    switch (filter) {
      case 'none':
        return k.currentActivations === 0;
      case 'mid':
        return k.currentActivations >= 1 && k.currentActivations < k.maxActivations;
      case 'near_limit':
        return k.currentActivations === k.maxActivations - 1;
      case 'at_limit':
        return k.currentActivations >= k.maxActivations;
    }
  });
}
