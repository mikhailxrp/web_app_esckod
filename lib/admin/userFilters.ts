import type { Prisma } from '@prisma/client';
import type { ExportUsersQuery, ListUsersQuery } from '@/lib/validations/admin-users';

type UserFilterParams = Pick<ListUsersQuery, 'search' | 'status'>;

export function buildUsersWhere(params: UserFilterParams): Prisma.UserWhereInput {
  const { search, status } = params;

  return {
    ...(search && {
      OR: [
        { email: { contains: search } },
        { name: { contains: search } },
      ],
    }),
    ...(status === 'active' && { isBlocked: false }),
    ...(status === 'blocked' && { isBlocked: true }),
  };
}

export function buildUsersWhereFromExportQuery(
  params: ExportUsersQuery,
): Prisma.UserWhereInput {
  return buildUsersWhere(params);
}
