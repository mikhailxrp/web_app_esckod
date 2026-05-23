import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generatePassword, hashPassword } from '@/lib/password';
import { sendPasswordResetEmail } from '@/lib/resend';
import { resetSchema } from '@/lib/validations/auth';

const PASSWORD_LENGTH = 12;

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

  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user || user.isBlocked) {
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
