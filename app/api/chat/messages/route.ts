import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getChatHistory } from '@/lib/chat/history';
import { messagesQuerySchema } from '@/lib/validations/chat';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'PLAYER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = messagesQuerySchema.safeParse({
    chatType: searchParams.get('chatType'),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  try {
    const messages = await getChatHistory(session.user.id, parsed.data.chatType);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('[GET /api/chat/messages]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
