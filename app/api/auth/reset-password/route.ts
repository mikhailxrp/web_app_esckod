import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generatePassword, hashPassword } from '@/lib/password';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendPasswordResetEmail } from '@/lib/resend';
import { resetSchema } from '@/lib/validations/auth';

const PASSWORD_LENGTH = 12;
const RESET_RATE_LIMIT_MAX = 3;
const RESET_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const SUCCESS_RESPONSE = { success: true } as const;

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
      `${ip}:${data.email}`,
      RESET_RATE_LIMIT_MAX,
      RESET_RATE_LIMIT_WINDOW_MS,
    )
  ) {
    return NextResponse.json(
      { success: false, error: 'RATE_LIMIT_EXCEEDED' },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'EMAIL_NOT_FOUND' },
      { status: 404 },
    );
  }

  if (user.isBlocked) {
    return NextResponse.json(SUCCESS_RESPONSE);
  }

  const newPassword = generatePassword(PASSWORD_LENGTH);
  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  try {
    await sendPasswordResetEmail(user.email, newPassword);
  } catch (error) {
    console.error('Reset email failed:', error);
  }

  return NextResponse.json(SUCCESS_RESPONSE);
}
