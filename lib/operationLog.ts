import { LogType } from '@prisma/client';
import { logTemplates, type LogTemplateKey } from '@/constants/logTemplates';
import { prisma } from '@/lib/prisma';

interface WriteLogOptions {
  userId: string;
  templateKey: LogTemplateKey;
  params?: Record<string, string | number>;
  type: LogType;
}

export async function writeLog(options: WriteLogOptions): Promise<void> {
  const message = renderLogMessage(options.templateKey, options.params ?? {});

  await prisma.operationLog.create({
    data: {
      userId: options.userId,
      type: options.type,
      message,
    },
  });
}

export function renderLogMessage(
  templateKey: LogTemplateKey,
  params: Record<string, string | number> = {},
): string {
  const template = logTemplates[templateKey];

  if (!template) {
    throw new Error(`Unknown log template: ${templateKey}`);
  }

  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}
