import type { Prisma } from '@prisma/client';
import type { ExportUsersQuery, ListUsersQuery } from '@/lib/validations/admin-users';

type UserFilterParams = Pick<ListUsersQuery, 'search' | 'status'> & {
  completions?: ListUsersQuery['completions'];
  consent?: boolean;
  idIn?: string[];
};

export function buildUsersWhere(params: UserFilterParams): Prisma.UserWhereInput {
  const { search, status, consent, completions, idIn } = params;

  return {
    ...(search && {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
        { accessKey: { key: { contains: search, mode: 'insensitive' as const } } },
      ],
    }),
    ...(status === 'active' && { isBlocked: false }),
    ...(status === 'blocked' && { isBlocked: true }),
    ...(consent === true && { consentMarketing: true }),
    ...(completions === '0' && { gameCompletions: { none: {} } }),
    ...(completions === '1plus' && { gameCompletions: { some: {} } }),
    ...(idIn !== undefined && { id: { in: idIn } }),
  };
}

export function buildUsersWhereFromExportQuery(
  params: ExportUsersQuery,
): Prisma.UserWhereInput {
  return buildUsersWhere(params);
}
