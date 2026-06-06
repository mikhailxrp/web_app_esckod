import 'server-only';

import { prisma } from '@/lib/prisma';

export type HintResult =
  | { isFinished: true }
  | {
      isFinished: false;
      hint: { id: string; orderIndex: number; text: string };
    };

function toHintResult(hint: {
  id: string;
  orderIndex: number;
  text: string;
}): HintResult {
  return {
    isFinished: false,
    hint: { id: hint.id, orderIndex: hint.orderIndex, text: hint.text },
  };
}

export async function getCurrentHint(userId: string): Promise<HintResult> {
  const progress = await prisma.userHintProgress.upsert({
    where: { userId },
    create: { userId, lastSeenHintIndex: 0 },
    update: {},
  });

  const hint = await prisma.detectiveHint.findFirst({
    where: {
      isActive: true,
      orderIndex: { gte: progress.lastSeenHintIndex },
    },
    orderBy: { orderIndex: 'asc' },
  });

  if (!hint) {
    return { isFinished: true };
  }

  return toHintResult(hint);
}

export async function advanceHint(userId: string): Promise<HintResult> {
  const progress = await prisma.userHintProgress.findUnique({
    where: { userId },
  });

  if (!progress) {
    await prisma.userHintProgress.create({
      data: { userId, lastSeenHintIndex: 0 },
    });
    return getCurrentHint(userId);
  }

  const current = await prisma.detectiveHint.findFirst({
    where: {
      isActive: true,
      orderIndex: { gte: progress.lastSeenHintIndex },
    },
    orderBy: { orderIndex: 'asc' },
  });

  if (!current) {
    return { isFinished: true };
  }

  const next = await prisma.detectiveHint.findFirst({
    where: {
      isActive: true,
      orderIndex: { gt: current.orderIndex },
    },
    orderBy: { orderIndex: 'asc' },
  });

  const newIndex = next ? next.orderIndex : current.orderIndex + 1;

  await prisma.userHintProgress.update({
    where: { userId },
    data: { lastSeenHintIndex: newIndex },
  });

  if (!next) {
    return { isFinished: true };
  }

  return toHintResult(next);
}
