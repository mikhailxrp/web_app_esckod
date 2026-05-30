import { NextResponse } from 'next/server';
import { writeAuditLog } from '@/lib/admin/auditLog';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await context.params;

  const admin = await prisma.adminUser.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!admin) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({
    ...admin,
    createdAt: admin.createdAt.toISOString(),
    lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
  });
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await context.params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: 'CANNOT_DELETE_SELF' },
      { status: 400 },
    );
  }

  const totalCount = await prisma.adminUser.count();

  if (totalCount <= 1) {
    return NextResponse.json(
      { error: 'CANNOT_DELETE_LAST_ADMIN' },
      { status: 400 },
    );
  }

  const existing = await prisma.adminUser.findUnique({
    where: { id },
    select: { email: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.adminUser.delete({ where: { id } }),
  ]);

  await writeAuditLog('admin_deleted', {
    adminId: session.user.id,
    message: `Администратор "${existing.email}" удалён`,
    metadata: { deletedAdminId: id, email: existing.email },
  });

  return NextResponse.json({ success: true });
}
