import { prisma } from '@/lib/prisma';
import { parseChoices } from '@/lib/validations/admin-chats';
import { ChatGraphValidatorBanner } from '@/components/admin/chats/ChatGraphValidatorBanner';
import { ChatScriptsTable } from '@/components/admin/chats/ChatScriptsTable';
import type { ChatScriptListItem } from '@/types/admin-chats';

export const metadata = {
  title: 'Управление чатами',
};

export default async function ChatsPage(): Promise<React.ReactElement> {
  const scripts = await prisma.chatScript.findMany({
    orderBy: [{ chatType: 'asc' }, { code: 'asc' }],
    select: {
      id: true,
      chatType: true,
      author: true,
      code: true,
      text: true,
      audioUrl: true,
      hasChoices: true,
      choices: true,
      isStart: true,
      isEnd: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const serialized: ChatScriptListItem[] = scripts.map((s) => ({
    ...s,
    choices: parseChoices(s.choices),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-white">
        Управление чатами
      </h1>

      <ChatGraphValidatorBanner />

      <ChatScriptsTable initialScripts={serialized} />
    </div>
  );
}
