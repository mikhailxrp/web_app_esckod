import { NextResponse } from 'next/server';
import { adminAuth as auth } from '@/lib/auth-admin';
import { validateReportConfig } from '@/lib/final-report/validate';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  try {
    const result = await validateReportConfig();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[report/validate] validateReportConfig failed:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Не удалось проверить конфигурацию отчёта' },
      { status: 500 },
    );
  }
}
