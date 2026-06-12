import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { deleteObject, extractKeyFromUrl } from '@/lib/s3';
import { fileRenameSchema } from '@/lib/validations/admin-files';

const RDP_FILE_SELECT = {
  id: true,
  slotId: true,
  name: true,
  url: true,
  size: true,
  folder: true,
  isLocked: true,
  createdAt: true,
} as const;

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function notFoundResponse(): NextResponse {
  return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
}

function validationErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: 'VALIDATION_ERROR', message: message ?? 'Неверные параметры запроса' },
    { status: 400 },
  );
}

function isPrismaNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}

function serializeRdpFile(file: {
  id: string;
  slotId: string;
  name: string;
  url: string;
  size: number | null;
  folder: string;
  isLocked: boolean;
  createdAt: Date;
}) {
  return {
    ...file,
    createdAt: file.createdAt.toISOString(),
  };
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await params;

  const file = await prisma.rdpFile.findUnique({
    where: { id },
    select: RDP_FILE_SELECT,
  });

  if (!file) {
    return notFoundResponse();
  }

  return NextResponse.json(serializeRdpFile(file));
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return validationErrorResponse();
  }

  const parsed = fileRenameSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const { name } = parsed.data;

  try {
    const updated = await prisma.rdpFile.update({
      where: { id },
      data: { name },
      select: RDP_FILE_SELECT,
    });

    return NextResponse.json(serializeRdpFile(updated));
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return notFoundResponse();
    }

    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await params;

  const file = await prisma.rdpFile.findUnique({
    where: { id },
    select: { id: true, url: true },
  });

  if (!file) {
    return notFoundResponse();
  }

  await prisma.rdpFile.delete({ where: { id } });

  try {
    await deleteObject(extractKeyFromUrl(file.url));
  } catch (error) {
    console.error('[files/[id]/route] S3 delete error (best-effort):', error);
  }

  return NextResponse.json({ success: true });
}
