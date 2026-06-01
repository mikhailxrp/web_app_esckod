import { NextRequest, NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import {
  buildWhereFromExportQuery,
  filterByActivationsExport,
} from '@/lib/admin/accessKeyFilters';
import { generateKeysCsv } from '@/lib/admin/csvExport';
import { prisma } from '@/lib/prisma';
import { exportQuerySchema } from '@/lib/validations/admin-keys';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function validationErrorResponse(): NextResponse {
  return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const sp = request.nextUrl.searchParams;
  const parsedQuery = exportQuerySchema.safeParse({
    status: sp.get('status') ?? undefined,
    activationsExport: sp.get('activationsExport') ?? undefined,
    limitChanged: sp.get('limitChanged') ?? undefined,
  });

  if (!parsedQuery.success) {
    return validationErrorResponse();
  }

  const { status, activationsExport, limitChanged } = parsedQuery.data;
  const where = buildWhereFromExportQuery(status, [], limitChanged);

  const allKeys = await prisma.accessKey.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      key: true,
      maxActivations: true,
      currentActivations: true,
      isBlocked: true,
      blockReason: true,
      createdAt: true,
      users: {
        select: { email: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  const keys = filterByActivationsExport(allKeys, activationsExport);
  const csv = generateKeysCsv(keys);

  const BOM = '\uFEFF';

  return new Response(BOM + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="keys.csv"',
    },
  });
}
