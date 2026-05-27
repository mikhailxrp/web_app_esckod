import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { buildWhereFromExportQuery } from '@/lib/admin/accessKeyFilters';
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

  const parsedQuery = exportQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsedQuery.success) {
    return validationErrorResponse();
  }

  const { status, activations } = parsedQuery.data;
  const where = buildWhereFromExportQuery(status, activations);

  const keys = await prisma.accessKey.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      key: true,
      maxActivations: true,
      currentActivations: true,
      isBlocked: true,
      createdAt: true,
    },
  });

  const csv = generateKeysCsv(keys);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="keys.csv"',
    },
  });
}
