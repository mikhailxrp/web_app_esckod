import { NextRequest, NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { parseChoices, ALLOWED_AUDIO_MIME, MAX_AUDIO_SIZE_BYTES, normalizeFilename } from '@/lib/validations/admin-chats';
import { putObject, deleteObject, buildPublicUrl, extractKeyFromUrl } from '@/lib/s3';
import { Prisma } from '@prisma/client';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function notFoundResponse(): NextResponse {
  return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
}

const SCRIPT_SELECT = {
  id: true,
  chatType: true,
  author: true,
  code: true,
  text: true,
  audioUrl: true,
  hasChoices: true,
  choices: true,
  isStart: true,
  isEnd: true,
  createdAt: true,
  updatedAt: true,
} as const;

function serializeScript(script: {
  id: string;
  chatType: string;
  author: string;
  code: string;
  text: string | null;
  audioUrl: string | null;
  hasChoices: boolean;
  choices: Prisma.JsonValue;
  isStart: boolean;
  isEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...script,
    choices: parseChoices(script.choices),
    createdAt: script.createdAt.toISOString(),
    updatedAt: script.updatedAt.toISOString(),
  };
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await params;

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Неверный формат запроса' },
      { status: 400 },
    );
  }

  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Файл не передан или пустой' },
      { status: 400 },
    );
  }

  const allowedMimes: readonly string[] = ALLOWED_AUDIO_MIME;

  if (!allowedMimes.includes(file.type)) {
    return NextResponse.json(
      { error: 'INVALID_FILE_TYPE', message: 'Допустимые форматы: MP3, WAV' },
      { status: 400 },
    );
  }

  if (file.size > MAX_AUDIO_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'FILE_TOO_LARGE', message: 'Файл превышает 5 МБ' },
      { status: 400 },
    );
  }

  const script = await prisma.chatScript.findUnique({
    where: { id },
    select: { id: true, audioUrl: true },
  });

  if (!script) {
    return notFoundResponse();
  }

  const key = `audio/chat/${id}/${normalizeFilename(file.name)}`;
  const oldAudioUrl = script.audioUrl;
  const oldKey = oldAudioUrl ? extractKeyFromUrl(oldAudioUrl) : null;

  const arrayBuffer = await file.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  try {
    await putObject(key, body, file.type);
  } catch (error) {
    console.error('[audio/route] S3 upload error:', error);

    return NextResponse.json(
      { error: 'S3_ERROR', message: 'Не удалось загрузить файл в хранилище' },
      { status: 502 },
    );
  }

  const newAudioUrl = buildPublicUrl(key);

  const updated = await prisma.chatScript.update({
    where: { id },
    data: { audioUrl: newAudioUrl },
    select: SCRIPT_SELECT,
  });

  if (oldKey && oldKey !== key) {
    try {
      await deleteObject(oldKey);
    } catch (error) {
      console.error('[audio/route] S3 delete old object error (best-effort):', error);
    }
  }

  return NextResponse.json(serializeScript(updated));
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

  const script = await prisma.chatScript.findUnique({
    where: { id },
    select: { id: true, audioUrl: true },
  });

  if (!script) {
    return notFoundResponse();
  }

  if (!script.audioUrl) {
    return NextResponse.json({ success: true });
  }

  const key = extractKeyFromUrl(script.audioUrl);

  await prisma.chatScript.update({
    where: { id },
    data: { audioUrl: null },
  });

  try {
    await deleteObject(key);
  } catch (error) {
    console.error('[audio/route] S3 delete error (best-effort):', error);
  }

  return NextResponse.json({ success: true });
}
