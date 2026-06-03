import { NextRequest, NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import { prisma } from '@/lib/prisma';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

interface RouteParams {
  params: Promise<{ scriptId: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  const { scriptId } = await params;

  const count = await prisma.chatState.count({
    where: {
      OR: [
        { currentDetectiveMessageId: scriptId },
        { currentMarinaMessageId: scriptId },
      ],
    },
  });

  return NextResponse.json({ count });
}
