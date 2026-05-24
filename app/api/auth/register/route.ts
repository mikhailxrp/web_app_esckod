import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generatePassword, hashPassword } from '@/lib/password';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendPasswordEmail } from '@/lib/resend';
import { registerSchema } from '@/lib/validations/auth';

const PASSWORD_LENGTH = 12;
const REGISTER_RATE_LIMIT_MAX = 5;
const REGISTER_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const ACTIVATIONS_EXCEEDED_ERROR = 'ACTIVATIONS_EXCEEDED';

type RegisterErrorCode =
  | 'INVALID_KEY'
  | 'KEY_BLOCKED'
  | 'ACTIVATIONS_EXCEEDED'
  | 'EMAIL_EXISTS'
  | 'VALIDATION_ERROR';

function errorResponse(
  error: RegisterErrorCode,
  status = 400,
): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (!checkRateLimit(ip, REGISTER_RATE_LIMIT_MAX, REGISTER_RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json(
      { success: false, error: 'RATE_LIMIT_EXCEEDED' },
      { status: 429 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse('VALIDATION_ERROR');
  }

  let data: z.infer<typeof registerSchema>;

  try {
    data = registerSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('VALIDATION_ERROR');
    }

    throw error;
  }

  const key = await prisma.accessKey.findUnique({
    where: { key: data.accessKey },
  });

  if (!key) {
    return errorResponse('INVALID_KEY');
  }

  if (key.isBlocked) {
    return errorResponse('KEY_BLOCKED');
  }

  if (key.currentActivations >= key.maxActivations) {
    return errorResponse('ACTIVATIONS_EXCEEDED');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    return errorResponse('EMAIL_EXISTS');
  }

  const plainPassword = generatePassword(PASSWORD_LENGTH);
  const passwordHash = await hashPassword(plainPassword);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          accessKeyId: key.id,
          consentPolicy: true,
          consentMarketing: data.consentMarketing,
        },
      });

      await tx.gameProgress.create({ data: { userId: user.id } });
      await tx.chatState.create({ data: { userId: user.id } });

      const updated = await tx.accessKey.updateMany({
        where: {
          id: key.id,
          currentActivations: { lt: key.maxActivations },
        },
        data: { currentActivations: { increment: 1 } },
      });

      if (updated.count === 0) {
        throw new Error(ACTIVATIONS_EXCEEDED_ERROR);
      }
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === ACTIVATIONS_EXCEEDED_ERROR
    ) {
      return errorResponse('ACTIVATIONS_EXCEEDED');
    }

    throw error;
  }

  try {
    await sendPasswordEmail(data.email, plainPassword);
    return NextResponse.json({ success: true, emailSent: true });
  } catch (error) {
    console.error('Email send failed:', error);
    return NextResponse.json({
      success: true,
      emailSent: false,
      message:
        'Регистрация успешна, но письмо не отправлено. Используйте «Восстановить пароль».',
    });
  }
}
