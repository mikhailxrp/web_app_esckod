import 'server-only';

import type { ChatType, Prisma } from '@prisma/client';

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
