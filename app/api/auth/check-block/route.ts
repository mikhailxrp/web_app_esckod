import { type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkBlockSchema } from '@/lib/validations/auth';

type BlockStatus = 'ok' | 'USER_BLOCKED' | 'KEY_BLOCKED';

interface CheckBlockResponse {
  status: BlockStatus;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body: unknown = await req.json();
    const parsed = checkBlockSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { status: 'ok' } satisfies CheckBlockResponse,
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { isBlocked: true, accessKey: { select: { isBlocked: true } } },
    });

    if (!user) {
      return Response.json({ status: 'ok' } satisfies CheckBlockResponse);
    }

    if (user.isBlocked) {
      return Response.json({
        status: 'USER_BLOCKED',
      } satisfies CheckBlockResponse);
    }

    if (user.accessKey.isBlocked) {
      return Response.json({
        status: 'KEY_BLOCKED',
      } satisfies CheckBlockResponse);
    }

    return Response.json({ status: 'ok' } satisfies CheckBlockResponse);
  } catch (error) {
    console.error('check-block error:', error);
    return Response.json(
      { status: 'ok' } satisfies CheckBlockResponse,
      { status: 500 },
    );
  }
}
