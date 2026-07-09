import { NextResponse } from 'next/server';
import { writeAuditLog } from '@/lib/admin/auditLog';
import { adminAuth as auth } from '@/lib/auth-admin';
import { generatePassword, hashPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { sendAdminPasswordResetEmail } from '@/lib/resend';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function PATCH(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { id } = await context.params;

  const existing = await prisma.adminUser.findUnique({
    where: { id },
    select: { email: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const plain = generatePassword(12);
  const passwordHash = await hashPassword(plain);

  await prisma.adminUser.update({
    where: { id },
    data: { passwordHash },
  });

  await writeAuditLog('admin_password_changed', {
    adminId: session.user.id,
    message: `Пароль администратора "${existing.email}" сброшен`,
    metadata: { targetAdminId: id, email: existing.email },
  });

  try {
    await sendAdminPasswordResetEmail(existing.email, plain);
  } catch {
    // Письмо не отправлено — пароль все равно возвращаем в ответе
  }

  return NextResponse.json({ password: plain });
}
