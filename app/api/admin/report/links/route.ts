import { NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { updateLinksSchema } from '@/lib/validations/admin-report';
import type { LinkBlock, LinkImage } from '@/types/admin-report';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function validationErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: 'VALIDATION_ERROR', message: message ?? 'Неверные параметры запроса' },
    { status: 400 },
  );
}

function serializeLinkBlock(block: {
  id: string;
  blockIndex: number;
  text: string;
  images: unknown;
  updatedAt: Date;
}): LinkBlock {
  return {
    id: block.id,
    blockIndex: block.blockIndex,
    text: block.text,
    images: block.images as LinkImage[],
    updatedAt: block.updatedAt.toISOString(),
  };
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const blocks = await prisma.finalReportLinkBlock.findMany({
    orderBy: { blockIndex: 'asc' },
  });

  return NextResponse.json(blocks.map(serializeLinkBlock));
}

export async function PUT(request: Request): Promise<NextResponse> {
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

  const parsed = updateLinksSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const { blocks } = parsed.data;

  await prisma.$transaction(
    blocks.map((block) =>
      prisma.finalReportLinkBlock.upsert({
        where: { blockIndex: block.blockIndex },
        create: { blockIndex: block.blockIndex, text: block.text, images: [] },
        update: { text: block.text },
      }),
    ),
  );

  const updated = await prisma.finalReportLinkBlock.findMany({
    orderBy: { blockIndex: 'asc' },
  });

  return NextResponse.json(updated.map(serializeLinkBlock));
}
