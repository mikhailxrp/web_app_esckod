import { NextRequest, NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { deleteObject, extractKeyFromUrl } from '@/lib/s3';
import { folderDeleteSchema } from '@/lib/validations/admin-files';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function validationErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: 'VALIDATION_ERROR', message: message ?? 'Неверные параметры запроса' },
    { status: 400 },
  );
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
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

  const parsed = folderDeleteSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const { slotId, folder } = parsed.data;

  const files = await prisma.rdpFile.findMany({
    where: { slotId, folder },
    select: { id: true, url: true },
  });

  for (const file of files) {
    try {
      await deleteObject(extractKeyFromUrl(file.url));
    } catch (error) {
      console.error('[files/folder/route] S3 delete error (best-effort):', error);
    }
  }

  await prisma.rdpFile.deleteMany({ where: { slotId, folder } });

  return NextResponse.json({ count: files.length });
}
