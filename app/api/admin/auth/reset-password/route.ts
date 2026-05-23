import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generatePassword, hashPassword } from '@/lib/password';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendAdminPasswordResetEmail } from '@/lib/resend';
import { resetSchema } from '@/lib/validations/auth';

const PASSWORD_LENGTH = 12;
const RESET_RATE_LIMIT_MAX = 3;
const RESET_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'VALIDATION_ERROR' },
      { status: 400 },
    );
  }

  let data: z.infer<typeof resetSchema>;

  try {
    data = resetSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    throw error;
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (
    !checkRateLimit(
      `admin-reset:${ip}:${data.email}`,
      RESET_RATE_LIMIT_MAX,
      RESET_RATE_LIMIT_WINDOW_MS,
    )
  ) {
    return NextResponse.json(
      { success: false, error: 'RATE_LIMIT_EXCEEDED' },
      { status: 429 },
    );
  }

  const admin = await prisma.adminUser.findUnique({
    where: { email: data.email },
  });

  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'ADMIN_NOT_FOUND' },
      { status: 400 },
    );
  }

  const newPassword = generatePassword(PASSWORD_LENGTH);
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash },
    }),
    prisma.adminAuditLog.create({
      data: {
        type: 'admin_password_reset',
        adminId: admin.id,
        message: `Сброс пароля администратора ${admin.email} через форму восстановления`,
      },
    }),
  ]);

  try {
    await sendAdminPasswordResetEmail(admin.email, newPassword);
  } catch (error) {
    console.error('Admin reset email failed:', error);
  }

  return NextResponse.json({ success: true });
}
