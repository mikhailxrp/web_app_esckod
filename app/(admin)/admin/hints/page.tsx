import React from 'react';
import { prisma } from '@/lib/prisma';
import { HintsTable } from '@/components/admin/hints/HintsTable';
import type { HintListItem } from '@/types/admin-hints';

export const metadata = {
  title: 'Подсказки Детектива',
};

export default async function HintsPage(): Promise<React.ReactElement> {
  const raw = await prisma.detectiveHint.findMany({
    orderBy: { orderIndex: 'asc' },
    select: {
      id: true,
      orderIndex: true,
      text: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hints: HintListItem[] = raw.map((h) => ({
    ...h,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-white">
        Подсказки Детектива
      </h1>
      <HintsTable initialHints={hints} />
    </div>
  );
}
