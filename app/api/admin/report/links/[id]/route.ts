import { NextRequest, NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { deleteObject } from '@/lib/s3';
import type { LinkImage } from '@/types/admin-report';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await params;

  const block = await prisma.finalReportLinkBlock.findUnique({
    where: { id },
  });

  if (!block) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const images = (block.images as unknown) as LinkImage[];

  await Promise.allSettled(images.map((img) => deleteObject(img.key)));

  await prisma.finalReportLinkBlock.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
