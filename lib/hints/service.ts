import 'server-only';

import { prisma } from '@/lib/prisma';

export type HintResult =
  | { isFinished: true; canGoBack: boolean }
  | {
      isFinished: false;
      hint: { id: string; orderIndex: number; text: string };
      canGoBack: boolean;
    };

function toHint(hint: { id: string; orderIndex: number; text: string }) {
  return { id: hint.id, orderIndex: hint.orderIndex, text: hint.text };
}

async function hasHintBefore(orderIndex: number): Promise<boolean> {
  const prev = await prisma.detectiveHint.findFirst({
    where: { isActive: true, orderIndex: { lt: orderIndex } },
    select: { id: true },
  });
  return prev !== null;
}

export async function getCurrentHint(userId: string): Promise<HintResult> {
  const progress = await prisma.userHintProgress.upsert({
    where: { userId },
    create: { userId, lastSeenHintIndex: 0, currentHintIndex: 0 },
    update: {},
  });

  const hint = await prisma.detectiveHint.findFirst({
    where: {
      isActive: true,
      orderIndex: { gte: progress.currentHintIndex },
    },
    orderBy: { orderIndex: 'asc' },
  });

  if (!hint) {
    const canGoBack = await hasHintBefore(progress.currentHintIndex);
    return { isFinished: true, canGoBack };
  }

  const canGoBack = await hasHintBefore(hint.orderIndex);
  return { isFinished: false, hint: toHint(hint), canGoBack };
}

export async function advanceHint(userId: string): Promise<HintResult> {
  const progress = await prisma.userHintProgress.findUnique({
    where: { userId },
  });

  if (!progress) {
    await prisma.userHintProgress.create({
      data: { userId, lastSeenHintIndex: 0, currentHintIndex: 0 },
    });
    return getCurrentHint(userId);
  }

  const current = await prisma.detectiveHint.findFirst({
    where: {
      isActive: true,
      orderIndex: { gte: progress.currentHintIndex },
    },
    orderBy: { orderIndex: 'asc' },
  });

  if (!current) {
    const canGoBack = await hasHintBefore(progress.currentHintIndex);
    return { isFinished: true, canGoBack };
  }

  const next = await prisma.detectiveHint.findFirst({
    where: {
      isActive: true,
      orderIndex: { gt: current.orderIndex },
    },
    orderBy: { orderIndex: 'asc' },
  });

  const newCurrentIndex = next ? next.orderIndex : current.orderIndex + 1;
  const newLastSeen = Math.max(progress.lastSeenHintIndex, newCurrentIndex);

  await prisma.userHintProgress.update({
    where: { userId },
    data: { currentHintIndex: newCurrentIndex, lastSeenHintIndex: newLastSeen },
  });

  if (!next) {
    return { isFinished: true, canGoBack: true };
  }

  return { isFinished: false, hint: toHint(next), canGoBack: true };
}

export async function rewindHint(userId: string): Promise<HintResult> {
  const progress = await prisma.userHintProgress.findUnique({
    where: { userId },
  });

  if (!progress) {
    return getCurrentHint(userId);
  }

  // Find what's currently being shown (first active hint at currentHintIndex or beyond)
  const current = await prisma.detectiveHint.findFirst({
    where: {
      isActive: true,
      orderIndex: { gte: progress.currentHintIndex },
    },
    orderBy: { orderIndex: 'asc' },
  });

  // Reference point for "previous": either current hint's orderIndex, or the currentHintIndex cursor itself (finished state)
  const referenceIndex = current ? current.orderIndex : progress.currentHintIndex;

  const prev = await prisma.detectiveHint.findFirst({
    where: {
      isActive: true,
      orderIndex: { lt: referenceIndex },
    },
    orderBy: { orderIndex: 'desc' },
  });

  if (!prev) {
    // Already at the first hint — return current state unchanged
    return getCurrentHint(userId);
  }

  await prisma.userHintProgress.update({
    where: { userId },
    data: { currentHintIndex: prev.orderIndex },
  });

  const canGoBack = await hasHintBefore(prev.orderIndex);
  return { isFinished: false, hint: toHint(prev), canGoBack };
}
