import { NextRequest, NextResponse } from 'next/server';
import { buildUsersWhere } from '@/lib/admin/userFilters';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { listUsersQuerySchema } from '@/lib/validations/admin-users';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function validationErrorResponse(): NextResponse {
  return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const sp = request.nextUrl.searchParams;
  const parsedQuery = listUsersQuerySchema.safeParse({
    page: sp.get('page') ?? undefined,
    limit: sp.get('limit') ?? undefined,
    search: sp.get('search') ?? undefined,
    status: sp.get('status') ?? undefined,
    sort: sp.get('sort') ?? undefined,
  });

  if (!parsedQuery.success) {
    return validationErrorResponse();
  }

  const { page, limit, search, status, sort } = parsedQuery.data;
  const where = buildUsersWhere({ search, status });
  const orderBy = { createdAt: sort === 'createdAt_asc' ? 'asc' : 'desc' } as const;

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        isBlocked: true,
        onboardingDone: true,
        consentMarketing: true,
        consentPolicy: true,
        createdAt: true,
        accessKey: {
          select: { key: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
