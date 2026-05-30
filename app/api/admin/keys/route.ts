import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { adminAuth as auth } from '@/lib/auth-admin';
import { buildAccessKeysWhere } from '@/lib/admin/accessKeyFilters';
import { prisma } from '@/lib/prisma';
import {
  createKeySchema,
  listKeysQuerySchema,
} from '@/lib/validations/admin-keys';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function validationErrorResponse(): NextResponse {
  return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
}

function isPrismaUniqueError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const sp = request.nextUrl.searchParams;
  const parsedQuery = listKeysQuerySchema.safeParse({
    page: sp.get('page') ?? undefined,
    limit: sp.get('limit') ?? undefined,
    q: sp.get('q') ?? undefined,
    status: sp.get('status') ?? undefined,
    sort: sp.get('sort') ?? undefined,
    activations: sp.getAll('activations'),
    limitChanged: sp.get('limitChanged') ?? undefined,
  });

  if (!parsedQuery.success) {
    return validationErrorResponse();
  }

  const { page, limit, q, status, sort, activations, limitChanged } = parsedQuery.data;
  const where = buildAccessKeysWhere({ q, status, activations, limitChanged });

  const ORDER_BY_MAP = {
    createdAt_asc: { createdAt: 'asc' as const },
    createdAt_desc: { createdAt: 'desc' as const },
    activations_asc: { currentActivations: 'asc' as const },
    activations_desc: { currentActivations: 'desc' as const },
  };
  const orderBy = ORDER_BY_MAP[sort];

  const [keys, total] = await prisma.$transaction([
    prisma.accessKey.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
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

  return NextResponse.json({
    keys,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return validationErrorResponse();
  }

  let data: z.infer<typeof createKeySchema>;

  try {
    data = createKeySchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse();
    }

    throw error;
  }

  try {
    const key = await prisma.accessKey.create({
      data: {
        key: data.key,
        maxActivations: data.maxActivations,
      },
      select: {
        id: true,
        key: true,
        isBlocked: true,
        blockedAt: true,
        maxActivations: true,
        currentActivations: true,
        createdAt: true,
      },
    });

    return NextResponse.json(key, { status: 201 });
  } catch (error) {
    if (isPrismaUniqueError(error)) {
      return NextResponse.json({ error: 'KEY_EXISTS' }, { status: 400 });
    }

    throw error;
  }
}
