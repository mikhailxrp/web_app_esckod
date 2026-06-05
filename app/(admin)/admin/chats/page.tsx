import { buildTriggerValues } from '@/constants/chatTriggerEvents';
import { serializeTransition, TRANSITION_SELECT } from '@/lib/admin/chatTransitionApi';
import { prisma } from '@/lib/prisma';
import { parseChoices } from '@/lib/validations/admin-chats';
import { ChatsTabs } from '@/components/admin/chats/ChatsTabs';
import type { ChatScriptListItem, ChatTransitionListItem } from '@/types/admin-chats';

export const metadata = {
  title: 'Управление чатами',
};

export default async function ChatsPage(): Promise<React.ReactElement> {
  const [scripts, transitions, slots] = await Promise.all([
    prisma.chatScript.findMany({
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
    }),
    prisma.chatTransition.findMany({
      select: TRANSITION_SELECT,
      orderBy: [
        { fromMessage: { code: 'asc' } },
        { priority: 'desc' },
      ],
    }),
    prisma.missionSlot.findMany({
      select: { slotKey: true },
      orderBy: { slotKey: 'asc' },
    }),
  ]);

  const serializedScripts: ChatScriptListItem[] = scripts.map((s) => ({
    ...s,
    choices: parseChoices(s.choices),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  const serializedTransitions: ChatTransitionListItem[] = transitions.map(
    (t) => serializeTransition(t),
  );

  const triggerValues = buildTriggerValues(slots.map((s) => s.slotKey));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-white">
        Управление чатами
      </h1>

      <ChatsTabs
        initialScripts={serializedScripts}
        initialTransitions={serializedTransitions}
        initialTriggerValues={triggerValues}
      />
    </div>
  );
}
