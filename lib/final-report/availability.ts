import 'server-only';

import { prisma } from '@/lib/prisma';

export interface AvailabilityResult {
  available: boolean;
  alreadySubmitted: boolean;
  reasonsBlocked?: string[];
}

export async function checkAvailability(userId: string): Promise<AvailabilityResult> {
  const [chatState, progress] = await Promise.all([
    prisma.chatState.findUnique({
      where: { userId },
      select: { detectiveFinished: true },
    }),
    prisma.gameProgress.findUnique({
      where: { userId },
      select: { finalReportDone: true },
    }),
  ]);

  const detectiveDone = chatState?.detectiveFinished ?? false;
  const alreadySubmitted = progress?.finalReportDone ?? false;

  const reasonsBlocked: string[] = [];

  if (!detectiveDone) {
    reasonsBlocked.push('DETECTIVE_NOT_FINISHED');
  }

  return {
    available: detectiveDone,
    alreadySubmitted,
    reasonsBlocked: reasonsBlocked.length > 0 ? reasonsBlocked : undefined,
  };
}
