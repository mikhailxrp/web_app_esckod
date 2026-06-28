import { NextResponse } from 'next/server';

import { requirePlayer } from '@/lib/auth-guards';
import { submitReport } from '@/lib/final-report/submit';
import { submitSchema } from '@/lib/validations/final-report';

export async function POST(req: Request): Promise<NextResponse> {
  const guard = await requirePlayer();

  if (!guard.ok) {
    return guard.response;
  }

  const session = guard.session;

  const parsed = submitSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await submitReport(session.user.id, parsed.data);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.error, ...(result.error.details && { details: result.error.details }) },
        { status: result.error.status },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('[POST /api/final-report/submit]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
