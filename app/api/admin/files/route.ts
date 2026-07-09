import { NextRequest, NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { buildPublicUrl, putObject } from '@/lib/s3';
import {
  ALLOWED_RDP_MIME,
  MAX_RDP_FILE_SIZE_BYTES,
  buildRdpFileKey,
  fileUploadFieldsSchema,
  normalizeFilename,
} from '@/lib/validations/admin-files';

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

function validationErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    { error: 'VALIDATION_ERROR', message: message ?? 'Неверные параметры запроса' },
    { status: 400 },
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

  const slotIdRaw = formData.get('slotId');
  const folderRaw = formData.get('folder');
  const nameRaw = formData.get('name');

  const fieldsParsed = fileUploadFieldsSchema.safeParse({
    slotId: typeof slotIdRaw === 'string' ? slotIdRaw : undefined,
    folder: typeof folderRaw === 'string' ? folderRaw : undefined,
    name: typeof nameRaw === 'string' && nameRaw.length > 0 ? nameRaw : undefined,
  });

  if (!fieldsParsed.success) {
    return validationErrorResponse(fieldsParsed.error.errors[0]?.message);
  }

  const { slotId, folder, name: optionalName } = fieldsParsed.data;

  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return validationErrorResponse('Файл не передан или пустой');
  }

  const slot = await prisma.missionSlot.findUnique({
    where: { id: slotId },
    select: { id: true, slotKey: true, missionType: true },
  });

  if (!slot || slot.missionType !== 'RDP') {
    return NextResponse.json(
      { error: 'NOT_RDP_SLOT', message: 'Слот не найден или не является RDP-слотом' },
      { status: 400 },
    );
  }

  if (!(ALLOWED_RDP_MIME as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: 'INVALID_FILE_TYPE', message: 'Допустимые форматы: PDF, JPG, PNG' },
      { status: 400 },
    );
  }

  if (file.size > MAX_RDP_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'FILE_TOO_LARGE', message: 'Файл превышает 10 МБ' },
      { status: 400 },
    );
  }

  const normalizedName = normalizeFilename(optionalName ?? file.name);

  const existingFile = await prisma.rdpFile.findFirst({
    where: { slotId, folder, name: normalizedName },
    select: { id: true },
  });

  if (existingFile) {
    return NextResponse.json(
      { error: 'FILE_NAME_EXISTS', message: 'Файл с таким именем уже существует в папке' },
      { status: 400 },
    );
  }

  const folderSample = await prisma.rdpFile.findFirst({
    where: { slotId, folder },
    select: { isLocked: true },
  });

  const isLocked = folderSample?.isLocked ?? false;
  const rawKey = buildRdpFileKey(slot.slotKey, folder, normalizedName);

  const arrayBuffer = await file.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  try {
    await putObject(rawKey, body, file.type);
  } catch (error) {
    console.error('[files/route] S3 upload error:', error);

    return NextResponse.json(
      { error: 'S3_ERROR', message: 'Не удалось загрузить файл в хранилище' },
      { status: 502 },
    );
  }

  const created = await prisma.rdpFile.create({
    data: {
      slotId,
      folder,
      name: normalizedName,
      url: buildPublicUrl(rawKey),
      isLocked,
    },
    select: RDP_FILE_SELECT,
  });

  return NextResponse.json(serializeRdpFile(created), { status: 201 });
}
