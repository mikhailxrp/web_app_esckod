import { NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import { validateChatGraph } from '@/lib/admin/chatGraphValidator';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const result = await validateChatGraph();

  return NextResponse.json(result);
}
