import { NextResponse } from 'next/server';
import { z } from 'zod';
import { writeAuditLog } from '@/lib/admin/auditLog';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateUserSchema } from '@/lib/validations/admin-users';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  isBlocked: true,
  onboardingDone: true,
  consentMarketing: true,
  consentPolicy: true,
  createdAt: true,
  accessKey: {
    select: {
      key: true,
      isBlocked: true,
    },
  },
} as const;

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function validationErrorResponse(): NextResponse {
  return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
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

  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });

  if (!user) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return validationErrorResponse();
  }

  let data: z.infer<typeof updateUserSchema>;

  try {
    data = updateUserSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse();
    }

    throw error;
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { email: true },
  });

  if (!existingUser) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const { isBlocked } = data;

  if (isBlocked) {
    await writeAuditLog('user_blocked', {
      adminId: session.user.id,
      userId: id,
      message: `Пользователь "${existingUser.email}" заблокирован`,
      metadata: { userId: id },
    });
  } else {
    await writeAuditLog('user_unblocked', {
      adminId: session.user.id,
      userId: id,
      message: `Пользователь "${existingUser.email}" разблокирован`,
      metadata: { userId: id },
    });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isBlocked },
    select: userSelect,
  });

  return NextResponse.json(user);
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

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existingUser) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
