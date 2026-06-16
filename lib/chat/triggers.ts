import 'server-only';

import type { ChatState, ChatType, Prisma } from '@prisma/client';

const TRIGGER_CHAT_TYPES: readonly ChatType[] = ['DETECTIVE', 'MARINA'];

export async function advanceTriggerListeners(
  tx: Prisma.TransactionClient,
  userId: string,
  triggerCode: string,
): Promise<void> {
  const state = await tx.chatState.findUnique({ where: { userId } });
  if (!state) {
    return;
  }

  // Always record the trigger as fired so it can be re-applied later if the chat
  // was blocked on a player choice at the moment this trigger occurred
  if (!state.firedTriggers.includes(triggerCode)) {
    await tx.chatState.update({
      where: { userId },
      // firedTriggers is server-internal tracking — no version increment here
      data: { firedTriggers: { push: triggerCode } },
    });
  }

  for (const chatType of TRIGGER_CHAT_TYPES) {
    const currentId =
      chatType === 'DETECTIVE'
        ? state.currentDetectiveMessageId
        : state.currentMarinaMessageId;

    if (!currentId) {
      continue;
    }

    const transition = await tx.chatTransition.findFirst({
      where: {
        fromMessageId: currentId,
        conditionType: 'TRIGGER',
        conditionValue: triggerCode,
      },
      orderBy: { priority: 'desc' },
    });

    if (!transition) {
      continue;
    }

    const nextMessage = await tx.chatScript.findUnique({
      where: { id: transition.toMessageId },
    });

    if (!nextMessage) {
      continue;
    }

    const pointerField =
      chatType === 'DETECTIVE' ? 'currentDetectiveMessageId' : 'currentMarinaMessageId';
    const finishedField =
      chatType === 'DETECTIVE' ? 'detectiveFinished' : 'marinaFinished';

    await tx.chatState.update({
      where: { userId },
      data: {
        [pointerField]: nextMessage.id,
        version: { increment: 1 },
        ...(nextMessage.isEnd && { [finishedField]: true }),
      },
    });
  }
}

/**
 * Re-applies all previously fired triggers for a user.
 *
 * Call this after advancing to a new message that is `isWaiting = true`.
 * Handles the case where a trigger fired while the player was blocked on a
 * choice — the trigger was logged but could not advance the chat at that time.
 *
 * Returns the fresh ChatState after all re-applications, or null if no state exists.
 */
export async function reapplyFiredTriggers(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<ChatState | null> {
  const state = await tx.chatState.findUnique({ where: { userId } });
  if (!state || state.firedTriggers.length === 0) {
    return state ?? null;
  }

  for (const trigger of state.firedTriggers) {
    await advanceTriggerListeners(tx, userId, trigger);
  }

  return tx.chatState.findUnique({ where: { userId } });
}
