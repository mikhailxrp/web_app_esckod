import { NextResponse } from 'next/server';
import { buildTriggerValues } from '@/constants/chatTriggerEvents';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const slots = await prisma.missionSlot.findMany({
    select: { slotKey: true },
    orderBy: { slotKey: 'asc' },
  });

  const values = buildTriggerValues(slots.map((s) => s.slotKey));

  return NextResponse.json({ values });
}
