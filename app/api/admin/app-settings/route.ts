import { NextRequest, NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';
import { updateSettingsSchema } from '@/lib/validations/app-settings';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const settings = await prisma.appSettings.findFirst();

  if (!settings) {
    return NextResponse.json(
      { error: 'Settings not initialized' },
      { status: 500 },
    );
  }

  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: 'Invalid JSON' },
      { status: 400 },
    );
  }

  const parsed = updateSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await prisma.appSettings.findFirst();

  if (!existing) {
    return NextResponse.json(
      { error: 'Settings not initialized' },
      { status: 500 },
    );
  }

  const updated = await prisma.appSettings.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}
