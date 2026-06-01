import { NextResponse } from 'next/server';
import { z } from 'zod';
import { writeAuditLog } from '@/lib/admin/auditLog';
import { adminAuth as auth } from '@/lib/auth-admin';
import { generatePassword, hashPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { createAdminSchema } from '@/lib/validations/admin-admins';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function validationErrorResponse(): NextResponse {
  return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  const serialized = admins.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ admins: serialized });
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

  let data: z.infer<typeof createAdminSchema>;

  try {
    data = createAdminSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse();
    }

    throw error;
  }

  const plain = generatePassword(12);
  const passwordHash = await hashPassword(plain);

  try {
    const admin = await prisma.adminUser.create({
      data: {
        email: data.email,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    await writeAuditLog('admin_created', {
      adminId: session.user.id,
      message: `Администратор "${admin.email}" создан`,
      metadata: { newAdminId: admin.id, email: admin.email },
    });

    return NextResponse.json({
      id: admin.id,
      email: admin.email,
      password: plain,
    });
  } catch (error) {
    const prismaError = error as { code?: string };

    if (prismaError.code === 'P2002') {
      return NextResponse.json({ error: 'EMAIL_EXISTS' }, { status: 400 });
    }

    throw error;
  }
}
