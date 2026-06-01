import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminAuth as auth } from '@/lib/auth-admin';
import { parseKeysCsv } from '@/lib/admin/csvImport';
import { prisma } from '@/lib/prisma';

function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function isPrismaUniqueError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

async function readCsvText(request: Request): Promise<string> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');

    if (file instanceof File) {
      return file.text();
    }

    const csvField = formData.get('csv');

    if (typeof csvField === 'string') {
      return csvField;
    }

    throw new Error('Invalid CSV: missing file or csv field');
  }

  return request.text();
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();

  if (!session || session.user.type !== 'ADMIN') {
    return forbiddenResponse();
  }

  let text: string;

  try {
    text = await readCsvText(request);
  } catch (error) {
    console.error('CSV import read failed:', error);
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  let rows;

  try {
    rows = parseKeysCsv(text);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid CSV format';

    return NextResponse.json(
      { created: 0, skipped: 0, errors: [message] },
      { status: 400 },
    );
  }

  const results = await Promise.allSettled(
    rows.map((row) =>
      prisma.accessKey
        .create({
          data: {
            key: row.key,
            maxActivations: row.maxActivations,
          },
        })
        .then(() => 'created' as const)
        .catch((error: unknown) => {
          if (isPrismaUniqueError(error)) {
            return 'skipped' as const;
          }

          throw error;
        }),
    ),
  );

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      if (result.value === 'created') {
        created += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    const message =
      result.reason instanceof Error
        ? result.reason.message
        : 'Unknown import error';

    errors.push(`Row ${index + 2}: ${message}`);
  }

  return NextResponse.json({ created, skipped, errors });
}
