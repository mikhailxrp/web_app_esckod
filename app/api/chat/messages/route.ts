import { NextRequest, NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { getChatHistory } from '@/lib/chat/history';
import { applyTemplateToView } from '@/lib/chat/template';
import { prisma } from '@/lib/prisma';
import { messagesQuerySchema } from '@/lib/validations/chat';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

  const { searchParams } = new URL(req.url);
  const parsed = messagesQuerySchema.safeParse({
    chatType: searchParams.get('chatType'),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const messages = await getChatHistory(session.user.id, parsed.data.chatType);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { email: true },
    });
    const vars = { email: user.email };

    return NextResponse.json({
      messages: messages.map((message) => applyTemplateToView(message, vars)),
    });
  } catch (error) {
    console.error('[GET /api/chat/messages]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
