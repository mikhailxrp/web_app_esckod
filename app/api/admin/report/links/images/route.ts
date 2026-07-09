import { NextRequest, NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { buildPublicUrl, putObject, deleteObject } from '@/lib/s3';
import {
  ALLOWED_IMAGE_MIME,
  normalizeFilename,
} from '@/lib/validations/admin-files';
import {
  linkImageUploadFieldsSchema,
  linkImageDeleteSchema,
  MAX_LINK_IMAGE_SIZE_BYTES,
} from '@/lib/validations/admin-report';
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

function buildLinkImageKey(blockId: string, name: string): string {
  return `files/report-links/${blockId}/${name}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return validationErrorResponse('Неверный формат запроса');
  }

  const blockIdRaw = formData.get('blockId');

  const fieldsParsed = linkImageUploadFieldsSchema.safeParse({
    blockId: typeof blockIdRaw === 'string' ? blockIdRaw : undefined,
  });

  if (!fieldsParsed.success) {
    return validationErrorResponse(fieldsParsed.error.errors[0]?.message);
  }

  const { blockId } = fieldsParsed.data;

  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return validationErrorResponse('Файл не передан или пустой');
  }

  if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: 'INVALID_FILE_TYPE', message: 'Допустимые форматы: JPG, PNG' },
      { status: 400 },
    );
  }

  if (file.size > MAX_LINK_IMAGE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'FILE_TOO_LARGE', message: 'Файл превышает 5 МБ' },
      { status: 400 },
    );
  }

  const block = await prisma.finalReportLinkBlock.findUnique({
    where: { id: blockId },
  });

  if (!block) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Блок ссылок не найден' },
      { status: 404 },
    );
  }

  const normalizedName = normalizeFilename(file.name);
  const key = buildLinkImageKey(blockId, normalizedName);

  const arrayBuffer = await file.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  try {
    await putObject(key, body, file.type);
  } catch (error) {
    console.error('[report/links/images POST] S3 upload error:', error);

    return NextResponse.json(
      { error: 'S3_ERROR', message: 'Не удалось загрузить изображение в хранилище' },
      { status: 502 },
    );
  }

  const existingImages = (block.images as unknown) as LinkImage[];
  const newImage: LinkImage = { url: buildPublicUrl(key), key };
  const nextImages = [...existingImages, newImage] as unknown as import('@prisma/client').Prisma.InputJsonValue;

  const updated = await prisma.finalReportLinkBlock.update({
    where: { id: blockId },
    data: { images: nextImages },
  });

  return NextResponse.json(serializeLinkBlock(updated), { status: 201 });
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

  const parsed = linkImageDeleteSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error.errors[0]?.message);
  }

  const { blockId, key } = parsed.data;

  const block = await prisma.finalReportLinkBlock.findUnique({
    where: { id: blockId },
  });

  if (!block) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const existingImages = (block.images as unknown) as LinkImage[];

  if (!existingImages.some((img) => img.key === key)) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Изображение не найдено' },
      { status: 404 },
    );
  }

  try {
    await deleteObject(key);
  } catch (error) {
    console.error('[report/links/images DELETE] S3 delete error:', error);
  }

  const filtered = existingImages.filter((img) => img.key !== key);
  const filteredJson = filtered as unknown as import('@prisma/client').Prisma.InputJsonValue;

  const updated = await prisma.finalReportLinkBlock.update({
    where: { id: blockId },
    data: { images: filteredJson },
  });

  return NextResponse.json(serializeLinkBlock(updated));
}
