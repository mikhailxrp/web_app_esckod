import 'server-only';

import { ChatScript, ChatType } from '@prisma/client';

import { toChatMessageView, type ChatMessageView } from '@/lib/chat/advance';
import { prisma } from '@/lib/prisma';

function makePlayerChoiceMessage(
  messageView: ChatMessageView,
  playerChoices: Record<string, string>,
): ChatMessageView | null {
  if (!messageView.hasChoices || !messageView.choices) return null;

  const chosenValue = playerChoices[messageView.code];
  if (chosenValue === undefined) return null;

  const chosenLabel = messageView.choices.find((c) => c.value === chosenValue)?.label;
  if (!chosenLabel) return null;

  return {
    id: `${messageView.id}_player`,
    code: `${messageView.code}_player`,
    text: chosenLabel,
    author: 'PLAYER',
    audioUrl: null,
    hasChoices: false,
    choices: null,
    isEnd: false,
  };
}

const MAX_HISTORY_WALK_ITERATIONS = 500;

function parsePlayerChoices(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }

  return result;
}

async function findNextHistoryMessage(
  current: ChatScript,
  playerChoices: Record<string, string>,
): Promise<ChatScript | null> {
  const transitions = await prisma.chatTransition.findMany({
    where: { fromMessageId: current.id },
    orderBy: { priority: 'desc' },
  });

  for (const transition of transitions) {
    if (transition.conditionType === 'ALWAYS') {
      return prisma.chatScript.findUnique({
        where: { id: transition.toMessageId },
      });
    }

    if (transition.conditionType === 'CHOICE') {
      const playerChoice = playerChoices[current.code];

      if (playerChoice === transition.conditionValue) {
        return prisma.chatScript.findUnique({
          where: { id: transition.toMessageId },
        });
      }
    }
  }

  return null;
}

export async function getChatHistory(
  userId: string,
  chatType: ChatType,
): Promise<ChatMessageView[]> {
  try {
    const state = await prisma.chatState.findUnique({ where: { userId } });

    if (!state) {
      return [];
    }

    const targetMessageId =
      chatType === 'DETECTIVE'
        ? state.currentDetectiveMessageId
        : state.currentMarinaMessageId;

    if (!targetMessageId) {
      return [];
    }

    const [start, targetMessage] = await Promise.all([
      prisma.chatScript.findFirst({
        where: { chatType, isStart: true },
      }),
      prisma.chatScript.findUnique({
        where: { id: targetMessageId },
      }),
    ]);

    if (!start || !targetMessage) {
      return targetMessage ? [toChatMessageView(targetMessage)] : [];
    }

    if (start.id === targetMessage.id) {
      return [toChatMessageView(targetMessage)];
    }

    const playerChoices = parsePlayerChoices(state.playerChoices);

    const startView = toChatMessageView(start);
    const history: ChatMessageView[] = [startView];

    const startPlayerMessage = makePlayerChoiceMessage(startView, playerChoices);
    if (startPlayerMessage) history.push(startPlayerMessage);

    const visited = new Set<string>([start.id]);

    let current: ChatScript = start;
    let iterations = 0;

    while (current.id !== targetMessage.id && iterations < MAX_HISTORY_WALK_ITERATIONS) {
      iterations += 1;

      const next = await findNextHistoryMessage(current, playerChoices);

      if (!next || visited.has(next.id)) {
        break;
      }

      visited.add(next.id);
      const nextView = toChatMessageView(next);
      history.push(nextView);

      const playerMessage = makePlayerChoiceMessage(nextView, playerChoices);
      if (playerMessage) history.push(playerMessage);

      current = next;
    }

    if (!history.some((message) => message.id === targetMessage.id)) {
      history.push(toChatMessageView(targetMessage));
    }

    return history;
  } catch (error) {
    console.error('[getChatHistory]', error);
    throw error;
  }
}
