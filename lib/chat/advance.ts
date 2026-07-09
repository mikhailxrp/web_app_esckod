import 'server-only';

import { ChatAuthor, ChatScript, ChatState, ChatTransition, ChatType, Prisma } from '@prisma/client';

import { CHAT_TRIGGER_EVENTS } from '@/constants/chatTriggerEvents';
import { advanceTriggerListeners, reapplyFiredTriggers } from '@/lib/chat/triggers';
import { prisma } from '@/lib/prisma';
import { parseChoices, type ChatChoice } from '@/lib/validations/admin-chats';

const MARINA_FINAL_CHOICE_CODE = 'marina_final_choice';

export interface ChatMessageView {
  id: string;
  code: string;
  text: string | null;
  author: ChatAuthor;
  audioUrl: string | null;
  hasChoices: boolean;
  choices: ChatChoice[] | null;
  isEnd: boolean;
}

export type AdvanceResult =
  | {
      status: 'ok';
      currentMessage: ChatMessageView;
      isWaiting: boolean;
      isFinished: boolean;
      version: number;
    }
  | { status: 'waiting'; currentMessage: ChatMessageView; version: number }
  | { status: 'choice_required'; currentMessage: ChatMessageView; version: number }
  | { status: 'invalid_choice' }
  | { status: 'conflict'; currentVersion: number }
  | { status: 'no_start' };

export type EnsureChatStartedResult =
  | { status: 'ok'; currentMessage: ChatMessageView; version: number }
  | { status: 'no_start' }
  | { status: 'conflict'; currentVersion: number };

interface AdvanceOptions {
  choiceValue?: string;
  expectedVersion: number;
}

type TransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

function isPrismaRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
  );
}

function getCurrentMessageId(state: ChatState, chatType: ChatType): string | null {
  return chatType === 'DETECTIVE'
    ? state.currentDetectiveMessageId
    : state.currentMarinaMessageId;
}

function getCurrentMessageField(chatType: ChatType): 'currentDetectiveMessageId' | 'currentMarinaMessageId' {
  return chatType === 'DETECTIVE' ? 'currentDetectiveMessageId' : 'currentMarinaMessageId';
}

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

export function toChatMessageView(script: ChatScript): ChatMessageView {
  return {
    id: script.id,
    code: script.code,
    text: script.text,
    author: script.author,
    audioUrl: script.audioUrl,
    hasChoices: script.hasChoices,
    choices: script.hasChoices ? parseChoices(script.choices) : null,
    isEnd: script.isEnd,
  };
}

function pickTransition(
  transitions: ChatTransition[],
  choiceValue?: string,
): ChatTransition | null {
  for (const transition of transitions) {
    if (transition.conditionType === 'ALWAYS') {
      return transition;
    }

    if (
      transition.conditionType === 'CHOICE' &&
      choiceValue !== undefined &&
      transition.conditionValue === choiceValue
    ) {
      return transition;
    }
  }

  return null;
}

export async function isChatMessageWaiting(messageId: string): Promise<boolean> {
  return messageIsWaitingOnly(prisma, messageId);
}

async function messageIsWaitingOnly(
  tx: TransactionClient,
  messageId: string,
): Promise<boolean> {
  const transitions = await tx.chatTransition.findMany({
    where: { fromMessageId: messageId },
  });

  if (transitions.length === 0) {
    return false;
  }

  return transitions.every((transition) => transition.conditionType === 'TRIGGER');
}

async function performAutoStart(
  tx: TransactionClient,
  state: ChatState,
  chatType: ChatType,
  expectedVersion: number,
): Promise<AdvanceResult> {
  const startMessage = await tx.chatScript.findFirst({
    where: { chatType, isStart: true },
  });

  if (!startMessage) {
    return { status: 'no_start' };
  }

  if (state.version !== expectedVersion) {
    return { status: 'conflict', currentVersion: state.version };
  }

  const field = getCurrentMessageField(chatType);

  try {
    const updated = await tx.chatState.update({
      where: { id: state.id, version: expectedVersion },
      data: {
        [field]: startMessage.id,
        version: { increment: 1 },
      },
    });

    const isWaiting = await messageIsWaitingOnly(tx, startMessage.id);

    return {
      status: 'ok',
      currentMessage: toChatMessageView(startMessage),
      isWaiting,
      isFinished: startMessage.isEnd,
      version: updated.version,
    };
  } catch (error) {
    if (isPrismaRecordNotFound(error)) {
      const fresh = await tx.chatState.findUnique({ where: { id: state.id } });

      return {
        status: 'conflict',
        currentVersion: fresh?.version ?? expectedVersion,
      };
    }

    throw error;
  }
}

export async function ensureChatStarted(
  userId: string,
  chatType: ChatType,
): Promise<EnsureChatStartedResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const state = await tx.chatState.findUniqueOrThrow({ where: { userId } });
      const currentMessageId = getCurrentMessageId(state, chatType);

      if (currentMessageId) {
        const current = await tx.chatScript.findUnique({
          where: { id: currentMessageId },
        });

        if (current) {
          return {
            status: 'ok',
            currentMessage: toChatMessageView(current),
            version: state.version,
          };
        }
      }

      const startMessage = await tx.chatScript.findFirst({
        where: { chatType, isStart: true },
      });

      if (!startMessage) {
        return { status: 'no_start' };
      }

      const field = getCurrentMessageField(chatType);

      try {
        const updated = await tx.chatState.update({
          where: { id: state.id, version: state.version },
          data: {
            [field]: startMessage.id,
            version: { increment: 1 },
          },
        });

        return {
          status: 'ok',
          currentMessage: toChatMessageView(startMessage),
          version: updated.version,
        };
      } catch (error) {
        if (isPrismaRecordNotFound(error)) {
          const fresh = await tx.chatState.findUnique({ where: { id: state.id } });

          return {
            status: 'conflict',
            currentVersion: fresh?.version ?? state.version,
          };
        }

        throw error;
      }
    });
  } catch (error) {
    console.error('[ensureChatStarted]', error);
    throw error;
  }
}

export async function advanceChatState(
  userId: string,
  chatType: ChatType,
  options: AdvanceOptions,
): Promise<AdvanceResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const state = await tx.chatState.findUniqueOrThrow({ where: { userId } });
      const currentMessageId = getCurrentMessageId(state, chatType);

      if (!currentMessageId) {
        return performAutoStart(tx, state, chatType, options.expectedVersion);
      }

      const current = await tx.chatScript.findUnique({
        where: { id: currentMessageId },
      });

      if (!current) {
        return performAutoStart(tx, state, chatType, options.expectedVersion);
      }

      if (current.isEnd) {
        return {
          status: 'ok',
          currentMessage: toChatMessageView(current),
          isWaiting: false,
          isFinished: true,
          version: state.version,
        };
      }

      if (current.hasChoices && options.choiceValue === undefined) {
        return {
          status: 'choice_required',
          currentMessage: toChatMessageView(current),
          version: state.version,
        };
      }

      const transitions = await tx.chatTransition.findMany({
        where: { fromMessageId: current.id },
        orderBy: { priority: 'desc' },
      });

      const chosen = pickTransition(transitions, options.choiceValue);

      if (!chosen) {
        if (options.choiceValue !== undefined) {
          return { status: 'invalid_choice' };
        }

        return {
          status: 'waiting',
          currentMessage: toChatMessageView(current),
          version: state.version,
        };
      }

      if (state.version !== options.expectedVersion) {
        return { status: 'conflict', currentVersion: state.version };
      }

      const next = await tx.chatScript.findUnique({
        where: { id: chosen.toMessageId },
      });

      if (!next) {
        return {
          status: 'waiting',
          currentMessage: toChatMessageView(current),
          version: state.version,
        };
      }

      const playerChoices = parsePlayerChoices(state.playerChoices);
      const field = getCurrentMessageField(chatType);
      const updateData: Prisma.ChatStateUpdateInput = {
        [field]: next.id,
        version: { increment: 1 },
      };

      if (chosen.conditionType === 'CHOICE' && options.choiceValue !== undefined) {
        playerChoices[current.code] = options.choiceValue;
        updateData.playerChoices = playerChoices;
      }

      if (current.code === MARINA_FINAL_CHOICE_CODE && options.choiceValue !== undefined) {
        updateData.finalChoice = options.choiceValue.toUpperCase();
      }

      if (next.isEnd) {
        if (chatType === 'DETECTIVE') {
          updateData.detectiveFinished = true;
        } else {
          updateData.marinaFinished = true;
        }
      }

      try {
        const updated = await tx.chatState.update({
          where: { id: state.id, version: options.expectedVersion },
          data: updateData,
        });

        const isWaiting = next.isEnd ? false : await messageIsWaitingOnly(tx, next.id);

        let finalVersion = updated.version;

        if (current.code === MARINA_FINAL_CHOICE_CODE && options.choiceValue !== undefined) {
          await advanceTriggerListeners(tx, userId, CHAT_TRIGGER_EVENTS.FINAL_CHOICE_MADE);
          const fresh = await tx.chatState.findUniqueOrThrow({ where: { id: state.id } });
          finalVersion = fresh.version;
        }

        // If the new message is waiting for a trigger, check if any previously fired
        // trigger (logged while the player was blocked on a choice) can advance it now
        let finalMessage = next;
        let finalIsWaiting = isWaiting;
        let finalIsFinished = next.isEnd;

        if (isWaiting) {
          const afterReapply = await reapplyFiredTriggers(tx, userId);

          if (afterReapply) {
            finalVersion = afterReapply.version;
            const newCurrentId = getCurrentMessageId(afterReapply, chatType);

            if (newCurrentId && newCurrentId !== next.id) {
              const newMsg = await tx.chatScript.findUnique({ where: { id: newCurrentId } });

              if (newMsg) {
                finalMessage = newMsg;
                finalIsFinished = newMsg.isEnd;
                finalIsWaiting = finalIsFinished
                  ? false
                  : await messageIsWaitingOnly(tx, newCurrentId);
              }
            }
          }
        }

        return {
          status: 'ok',
          currentMessage: toChatMessageView(finalMessage),
          isWaiting: finalIsWaiting,
          isFinished: finalIsFinished,
          version: finalVersion,
        };
      } catch (error) {
        if (isPrismaRecordNotFound(error)) {
          const fresh = await tx.chatState.findUnique({ where: { id: state.id } });

          return {
            status: 'conflict',
            currentVersion: fresh?.version ?? options.expectedVersion,
          };
        }

        throw error;
      }
    });
  } catch (error) {
    console.error('[advanceChatState]', error);
    throw error;
  }
}
