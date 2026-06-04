import 'server-only';

import { ChatType } from '@prisma/client';

import {
  ensureChatStarted,
  isChatMessageWaiting,
  toChatMessageView,
  type ChatMessageView,
} from '@/lib/chat/advance';
import { prisma } from '@/lib/prisma';

interface ChatSlotState {
  currentMessage: ChatMessageView | null;
  isWaiting: boolean;
  isFinished: boolean;
  isVisible: boolean;
}

export interface GetChatStateResult {
  detective: ChatSlotState & { isVisible: true };
  marina: ChatSlotState;
  finalChoice: string | null;
  version: number;
}

async function buildSlotFromMessageId(
  messageId: string | null,
  isVisible: boolean,
): Promise<ChatSlotState> {
  if (!messageId) {
    return {
      currentMessage: null,
      isWaiting: false,
      isFinished: false,
      isVisible,
    };
  }

  const message = await prisma.chatScript.findUnique({ where: { id: messageId } });

  if (!message) {
    return {
      currentMessage: null,
      isWaiting: false,
      isFinished: false,
      isVisible,
    };
  }

  const isFinished = message.isEnd;
  const isWaiting =
    !isFinished && (await isChatMessageWaiting(message.id));

  return {
    currentMessage: toChatMessageView(message),
    isWaiting,
    isFinished,
    isVisible,
  };
}

async function resolveChatSlot(
  userId: string,
  chatType: ChatType,
  isVisible: boolean,
): Promise<ChatSlotState> {
  if (!isVisible) {
    return {
      currentMessage: null,
      isWaiting: false,
      isFinished: false,
      isVisible: false,
    };
  }

  const started = await ensureChatStarted(userId, chatType);

  if (started.status === 'no_start') {
    return {
      currentMessage: null,
      isWaiting: false,
      isFinished: false,
      isVisible: true,
    };
  }

  if (started.status === 'ok') {
    const isFinished = started.currentMessage.isEnd;
    const isWaiting =
      !isFinished && (await isChatMessageWaiting(started.currentMessage.id));

    return {
      currentMessage: started.currentMessage,
      isWaiting,
      isFinished,
      isVisible: true,
    };
  }

  const state = await prisma.chatState.findUniqueOrThrow({ where: { userId } });
  const messageId =
    chatType === 'DETECTIVE'
      ? state.currentDetectiveMessageId
      : state.currentMarinaMessageId;

  return buildSlotFromMessageId(messageId, true);
}

export async function getChatState(userId: string): Promise<GetChatStateResult> {
  const progress = await prisma.gameProgress.findUnique({
    where: { userId },
    select: { marinaTriggered: true },
  });

  const marinaTriggered = progress?.marinaTriggered ?? false;

  const detective = await resolveChatSlot(userId, 'DETECTIVE', true);
  const marina = await resolveChatSlot(userId, 'MARINA', marinaTriggered);

  const freshState = await prisma.chatState.findUniqueOrThrow({
    where: { userId },
    select: { version: true, finalChoice: true },
  });

  return {
    detective: { ...detective, isVisible: true as const },
    marina,
    finalChoice: freshState.finalChoice,
    version: freshState.version,
  };
}
