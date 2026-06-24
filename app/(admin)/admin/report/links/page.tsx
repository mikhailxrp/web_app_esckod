import React from 'react';
import { prisma } from '@/lib/prisma';
import { LinksForm } from '@/components/admin/report/LinksForm';
import type { LinkBlock, LinkImage } from '@/types/admin-report';

export const metadata = {
  title: 'Финальный отчет — Ссылки',
};

function serializeLinkBlock(block: {
  id: string;
  blockIndex: number;
  text: string;
  images: unknown;
  updatedAt: Date;
}): LinkBlock {
  return {
    id: block.id,
    blockIndex: block.blockIndex,
    text: block.text,
    images: block.images as LinkImage[],
    updatedAt: block.updatedAt.toISOString(),
  };
}

export default async function ReportLinksPage(): Promise<React.ReactElement> {
  const blocks = await prisma.finalReportLinkBlock.findMany({
    orderBy: { blockIndex: 'asc' },
  });

  const initialBlocks = blocks.map(serializeLinkBlock);

  return <LinksForm initialBlocks={initialBlocks} />;
}
