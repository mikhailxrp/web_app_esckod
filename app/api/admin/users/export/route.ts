import { NextRequest, NextResponse } from 'next/server';
import { generateUsersEmailCsv } from '@/lib/admin/csvExport';
import { buildUsersWhereFromExportQuery } from '@/lib/admin/userFilters';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { exportUsersQuerySchema } from '@/lib/validations/admin-users';

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
  const parsedQuery = exportUsersQuerySchema.safeParse({
    search: sp.get('search') ?? undefined,
    status: sp.get('status') ?? undefined,
    consent: sp.get('consent') ?? undefined,
  });

  if (!parsedQuery.success) {
    return validationErrorResponse();
  }

  const where = buildUsersWhereFromExportQuery(parsedQuery.data);

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: { email: true },
  });

  const csv = generateUsersEmailCsv(users.map((u) => u.email));

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="users-emails.csv"',
    },
  });
}
