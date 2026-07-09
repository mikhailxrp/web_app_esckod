import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export type PlayerGuardResult =
  | { ok: true; userId: string; session: Session }
  | { ok: false; response: NextResponse };

/**
 * Гард для игровых API-роутов.
 *
 * Помимо проверки сессии и роли PLAYER, на КАЖДОМ запросе перечитывает
 * `isBlocked` пользователя и его ключа из БД. Это закрывает окно, в котором
 * заблокированный игрок продолжал бы работать по живому JWT до истечения сессии
 * (см. final-report.md → H-2): блокировка через админку начинает действовать
 * немедленно, а не через 24ч.
 *
 * Исполняется в Node-рантайме (использует Prisma) — намеренно НЕ в `proxy.ts`,
 * который работает в Edge-рантайме и несовместим с Prisma Client.
 */
export async function requirePlayer(): Promise<PlayerGuardResult> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      isBlocked: true,
      accessKey: { select: { isBlocked: true } },
    },
  });

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (user.isBlocked) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'USER_BLOCKED' }, { status: 403 }),
    };
  }

  if (user.accessKey.isBlocked) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'KEY_BLOCKED' }, { status: 403 }),
    };
  }

  return { ok: true, userId: session.user.id, session };
}
