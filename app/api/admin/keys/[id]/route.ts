import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { writeAuditLog } from '@/lib/admin/auditLog';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateKeySchema } from '@/lib/validations/admin-keys';

interface RouteContext {
  params: Promise<{ id: string }>;
}

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

  const [key, auditLogs] = await Promise.all([
    prisma.accessKey.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            isBlocked: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.adminAuditLog.findMany({
      where: {
        type: { in: ['key_blocked', 'key_unblocked'] },
        metadata: { path: ['keyId'], equals: id },
      },
      select: { type: true, message: true, createdAt: true, metadata: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!key) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({
    ...key,
    auditLogs: auditLogs.map((l) => {
      const meta = l.metadata as Record<string, unknown> | null;
      return {
        type: l.type,
        message: l.message,
        createdAt: l.createdAt.toISOString(),
        blockReason: typeof meta?.blockReason === 'string' ? meta.blockReason : null,
      };
    }),
  });
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

  let data: z.infer<typeof updateKeySchema>;

  try {
    data = updateKeySchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse();
    }

    throw error;
  }

  const existingKey = await prisma.accessKey.findUnique({
    where: { id },
    select: { key: true, currentActivations: true },
  });

  if (!existingKey) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const { maxActivations, isBlocked, blockReason } = data;
  const updateData: Prisma.AccessKeyUpdateInput = {};

  if (maxActivations !== undefined) {
    if (maxActivations < existingKey.currentActivations) {
      return NextResponse.json({ error: 'MAX_BELOW_CURRENT' }, { status: 400 });
    }

    updateData.maxActivations = maxActivations;
  }

  if (isBlocked === true) {
    updateData.isBlocked = true;
    updateData.blockedAt = new Date();

    if (blockReason !== undefined) {
      updateData.blockReason = blockReason;
    }

    await writeAuditLog('key_blocked', {
      adminId: session.user.id,
      message: `Ключ "${existingKey.key}" заблокирован${blockReason ? `: ${blockReason}` : ''}`,
      metadata: { keyId: id, blockReason },
    });
  }

  if (isBlocked === false) {
    updateData.isBlocked = false;
    updateData.blockedAt = null;
    updateData.blockReason = null;

    await writeAuditLog('key_unblocked', {
      adminId: session.user.id,
      message: `Ключ "${existingKey.key}" разблокирован`,
      metadata: { keyId: id },
    });
  }

  const updatedKey = await prisma.accessKey.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      key: true,
      isBlocked: true,
      blockedAt: true,
      blockReason: true,
      maxActivations: true,
      currentActivations: true,
      createdAt: true,
    },
  });

  return NextResponse.json(updatedKey);
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

  const key = await prisma.accessKey.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });

  if (!key) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  if (key._count.users > 0) {
    return NextResponse.json({ error: 'HAS_USERS' }, { status: 400 });
  }

  await prisma.accessKey.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
