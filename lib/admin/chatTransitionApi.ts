import { Prisma } from '@prisma/client';
import { fetchValidTriggerValueSet } from '@/constants/chatTriggerEvents';
import type { ChatTransitionListItem, ChatType, ConditionType } from '@/types/admin-chats';

export interface TransitionPayload {
  fromMessageId: string;
  toMessageId: string;
  conditionType: ConditionType;
  conditionValue: string | null;
  priority: number;
}

export type TransitionValidationError =
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'INVALID_TRIGGER_VALUE' }
  | { code: 'INVALID_REFERENCE' };

export async function validateTransitionPayload(
  payload: TransitionPayload,
): Promise<TransitionValidationError | null> {
  if (payload.conditionType === 'ALWAYS') {
    if (payload.conditionValue !== null && payload.conditionValue !== '') {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Для ALWAYS conditionValue должен быть пустым',
      };
    }

    return null;
  }

  if (!payload.conditionValue || payload.conditionValue.trim() === '') {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Для CHOICE и TRIGGER необходимо указать conditionValue',
    };
  }

  if (payload.conditionType === 'TRIGGER') {
    const validSet = await fetchValidTriggerValueSet();

    if (!validSet.has(payload.conditionValue)) {
      return { code: 'INVALID_TRIGGER_VALUE' };
    }
  }

  return null;
}

export function normalizeConditionValue(
  conditionType: ConditionType,
  conditionValue: string | null | undefined,
): string | null {
  if (conditionType === 'ALWAYS') {
    return null;
  }

  return conditionValue ?? null;
}

export const TRANSITION_SELECT = {
  id: true,
  fromMessageId: true,
  toMessageId: true,
  conditionType: true,
  conditionValue: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  fromMessage: {
    select: { id: true, code: true, chatType: true },
  },
  toMessage: {
    select: { id: true, code: true, chatType: true },
  },
} as const;

export function serializeTransition(transition: {
  id: string;
  fromMessageId: string;
  toMessageId: string;
  conditionType: string;
  conditionValue: string | null;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  fromMessage: { id: string; code: string; chatType: string };
  toMessage: { id: string; code: string; chatType: string };
}): ChatTransitionListItem {
  return {
    id: transition.id,
    fromMessageId: transition.fromMessageId,
    toMessageId: transition.toMessageId,
    conditionType: transition.conditionType as ConditionType,
    conditionValue: transition.conditionValue,
    priority: transition.priority,
    from: {
      ...transition.fromMessage,
      chatType: transition.fromMessage.chatType as ChatType,
    },
    to: {
      ...transition.toMessage,
      chatType: transition.toMessage.chatType as ChatType,
    },
    createdAt: transition.createdAt.toISOString(),
    updatedAt: transition.updatedAt.toISOString(),
  };
}

export function isPrismaForeignKeyError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003'
  );
}

export function isPrismaNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
  );
}
