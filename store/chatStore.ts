'use client';

import { create } from 'zustand';

import { fetchWithVersion } from '@/lib/api/fetchWithVersion';
import { toast } from '@/components/ui/Toast';
import type { ChatMessageView, ChatType } from '@/types/chat';

// =============================================================
// Constants
// =============================================================

const TYPING_DELAY_MS = 2500;

// Module-level timer storage — outside store state to avoid serialisation issues
const typingTimers: Partial<Record<ChatType, ReturnType<typeof setTimeout>>> = {};

function clearTypingTimer(chatType: ChatType): void {
  const existing = typingTimers[chatType];

  if (existing !== undefined) {
    clearTimeout(existing);
    delete typingTimers[chatType];
  }
}

// =============================================================
// Types
// =============================================================

type SlotStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ChatSlotState {
  messages: ChatMessageView[];
  isTyping: boolean;
  pendingMessage: ChatMessageView | null;
  unreadCount: number;
  isWaiting: boolean;
  isFinished: boolean;
  isVisible: boolean;
  status: SlotStatus;
}

interface ChatStore {
  detective: ChatSlotState;
  marina: ChatSlotState;
  finalChoice: string | null;
  version: number;
  error: string | null;
  refresh: () => Promise<void>;
  advance: (chatType: ChatType) => Promise<void>;
  choice: (chatType: ChatType, value: string) => Promise<void>;
  markRead: (chatType: ChatType) => void;
  showTriggeredMessage: (chatType: ChatType) => Promise<void>;
}

// =============================================================
// API response shapes
// =============================================================

interface StateSlot {
  currentMessage: ChatMessageView | null;
  isWaiting: boolean;
  isFinished: boolean;
  isVisible: boolean;
}

interface StateResponse {
  detective: StateSlot & { isVisible: true };
  marina: StateSlot;
  finalChoice: string | null;
  version: number;
}

interface MessagesResponse {
  messages: ChatMessageView[];
}

interface AdvanceResponse {
  currentMessage: ChatMessageView;
  isWaiting: boolean;
  isFinished: boolean;
  version: number;
}

// =============================================================
// Initial slot state
// =============================================================

const INITIAL_SLOT: ChatSlotState = {
  messages: [],
  isTyping: false,
  pendingMessage: null,
  unreadCount: 0,
  isWaiting: false,
  isFinished: false,
  isVisible: false,
  status: 'idle',
};

// =============================================================
// Helpers
// =============================================================

function slotKey(chatType: ChatType): 'detective' | 'marina' {
  return chatType === 'DETECTIVE' ? 'detective' : 'marina';
}

// Commit the pending message to the visible list after typing delay
function schedulePendingMessage(
  chatType: ChatType,
  messageId: string,
): void {
  clearTypingTimer(chatType);

  typingTimers[chatType] = setTimeout(() => {
    delete typingTimers[chatType];

    useChatStore.setState((s) => {
      const key = slotKey(chatType);
      const current = s[key];

      // Guard: only commit if the pending message is still the one we scheduled
      if (!current.pendingMessage || current.pendingMessage.id !== messageId) {
        return s;
      }

      return {
        [key]: {
          ...current,
          messages: [...current.messages, current.pendingMessage],
          isTyping: false,
          pendingMessage: null,
          unreadCount: current.unreadCount + 1,
        },
      };
    });
  }, TYPING_DELAY_MS);
}

// =============================================================
// Store
// =============================================================

export const useChatStore = create<ChatStore>((set, get) => ({
  detective: { ...INITIAL_SLOT, isVisible: true },
  marina: { ...INITIAL_SLOT },
  finalChoice: null,
  version: 0,
  error: null,

  refresh: async () => {
    // Cancel any pending typing timers before overwriting state
    clearTypingTimer('DETECTIVE');
    clearTypingTimer('MARINA');

    set((s) => ({
      detective: { ...s.detective, status: 'loading' },
      marina: { ...s.marina, status: 'loading' },
      error: null,
    }));

    try {
      const stateRes = await fetch('/api/chat/state');

      if (!stateRes.ok) {
        throw new Error(`/api/chat/state returned ${stateRes.status}`);
      }

      const state = (await stateRes.json()) as StateResponse;

      // Fetch messages for visible chats in parallel
      const fetchMessages = async (chatType: ChatType): Promise<ChatMessageView[]> => {
        const res = await fetch(`/api/chat/messages?chatType=${chatType}`);

        if (!res.ok) {
          throw new Error(`/api/chat/messages?chatType=${chatType} returned ${res.status}`);
        }

        const data = (await res.json()) as MessagesResponse;
        return data.messages;
      };

      const [detectiveMessages, marinaMessages] = await Promise.all([
        fetchMessages('DETECTIVE'),
        state.marina.isVisible ? fetchMessages('MARINA') : Promise.resolve([]),
      ]);

      set((s) => ({
        version: state.version,
        finalChoice: state.finalChoice,
        detective: {
          messages: detectiveMessages,
          isTyping: false,
          pendingMessage: null,
          unreadCount: Math.max(0, detectiveMessages.length - s.detective.messages.length),
          isWaiting: state.detective.isWaiting,
          isFinished: state.detective.isFinished,
          isVisible: true,
          status: 'ready',
        },
        marina: {
          messages: marinaMessages,
          isTyping: false,
          pendingMessage: null,
          unreadCount: Math.max(0, marinaMessages.length - s.marina.messages.length),
          isWaiting: state.marina.isWaiting,
          isFinished: state.marina.isFinished,
          isVisible: state.marina.isVisible,
          status: 'ready',
        },
        error: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки чатов';
      console.error('[chatStore.refresh]', error);
      set((s) => ({
        detective: { ...s.detective, status: 'error' },
        marina: { ...s.marina, status: 'error' },
        error: message,
      }));
    }
  },

  advance: async (chatType) => {
    const { version, refresh } = get();
    const slot = chatType === 'DETECTIVE' ? get().detective : get().marina;

    if (slot.status === 'loading') return;

    set((s) => ({
      [slotKey(chatType)]: {
        ...(chatType === 'DETECTIVE' ? s.detective : s.marina),
        status: 'loading',
      },
    }));

    try {
      const response = await fetchWithVersion('/api/chat/advance', {
        body: { chatType, expectedVersion: version },
        onConflict: refresh,
      });

      if (response.status === 409) {
        set((s) => ({
          [slotKey(chatType)]: {
            ...(chatType === 'DETECTIVE' ? s.detective : s.marina),
            status: 'ready',
          },
        }));
        return;
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        toast.error(data.error ?? 'Ошибка при переходе к следующей реплике');
        await refresh();
        return;
      }

      const data = (await response.json()) as AdvanceResponse;

      set((s) => {
        const current = s[slotKey(chatType)];
        const lastId = current.messages.at(-1)?.id;
        const shouldAppend = data.currentMessage.id !== lastId;

        if (!shouldAppend) {
          return {
            version: data.version,
            [slotKey(chatType)]: {
              ...current,
              isWaiting: data.isWaiting,
              isFinished: data.isFinished,
              status: 'ready',
            },
          };
        }

        // Skip typing delay: first message, choices prompt, or last message before waiting for trigger
        const skipTyping =
          current.messages.length === 0 || data.currentMessage.hasChoices || data.isWaiting;

        if (skipTyping) {
          const isFirstMessage = current.messages.length === 0;
          return {
            version: data.version,
            [slotKey(chatType)]: {
              ...current,
              messages: [...current.messages, data.currentMessage],
              unreadCount: isFirstMessage ? current.unreadCount : current.unreadCount + 1,
              isWaiting: data.isWaiting,
              isFinished: data.isFinished,
              status: 'ready',
            },
          };
        }

        // Show typing indicator, commit message after delay
        schedulePendingMessage(chatType, data.currentMessage.id);

        return {
          version: data.version,
          [slotKey(chatType)]: {
            ...current,
            isTyping: true,
            pendingMessage: data.currentMessage,
            isWaiting: data.isWaiting,
            isFinished: data.isFinished,
            status: 'ready',
          },
        };
      });
    } catch (error) {
      console.error('[chatStore.advance]', error);
      toast.error('Ошибка соединения');
      await refresh();
    }
  },

  choice: async (chatType, value) => {
    const { version, refresh } = get();
    const slot = chatType === 'DETECTIVE' ? get().detective : get().marina;

    if (slot.status === 'loading') return;

    set((s) => ({
      [slotKey(chatType)]: {
        ...(chatType === 'DETECTIVE' ? s.detective : s.marina),
        status: 'loading',
      },
    }));

    try {
      const response = await fetchWithVersion('/api/chat/choice', {
        body: { chatType, value, expectedVersion: version },
        onConflict: refresh,
      });

      if (response.status === 409) {
        set((s) => ({
          [slotKey(chatType)]: {
            ...(chatType === 'DETECTIVE' ? s.detective : s.marina),
            status: 'ready',
          },
        }));
        return;
      }

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        toast.error(data.error ?? 'Ошибка при выборе варианта');
        await refresh();
        return;
      }

      const data = (await response.json()) as AdvanceResponse;

      set((s) => {
        const current = s[slotKey(chatType)];
        const lastMessage = current.messages.at(-1);

        const chosenLabel =
          lastMessage?.choices?.find((c) => c.value === value)?.label ?? value;

        const playerMessage: ChatMessageView = {
          id: `${lastMessage?.id ?? 'unknown'}_player`,
          code: `${lastMessage?.code ?? 'unknown'}_player`,
          text: chosenLabel,
          author: 'PLAYER',
          audioUrl: null,
          hasChoices: false,
          choices: null,
          isEnd: false,
        };

        const lastId = lastMessage?.id;
        const shouldAppend = data.currentMessage.id !== lastId;

        if (!shouldAppend) {
          return {
            version: data.version,
            [slotKey(chatType)]: {
              ...current,
              messages: [...current.messages, playerMessage],
              isWaiting: data.isWaiting,
              isFinished: data.isFinished,
              status: 'ready',
            },
          };
        }

        // Skip typing delay for choices prompt (no text to "type")
        if (data.currentMessage.hasChoices) {
          return {
            version: data.version,
            finalChoice: chatType === 'MARINA' ? (s.finalChoice ?? null) : s.finalChoice,
            [slotKey(chatType)]: {
              ...current,
              messages: [...current.messages, playerMessage, data.currentMessage],
              unreadCount: current.unreadCount + 1,
              isWaiting: data.isWaiting,
              isFinished: data.isFinished,
              status: 'ready',
            },
          };
        }

        // Skip typing delay when next message only waits for a trigger
        if (data.isWaiting) {
          return {
            version: data.version,
            finalChoice: chatType === 'MARINA' ? (s.finalChoice ?? null) : s.finalChoice,
            [slotKey(chatType)]: {
              ...current,
              messages: [...current.messages, playerMessage, data.currentMessage],
              unreadCount: current.unreadCount + 1,
              isWaiting: data.isWaiting,
              isFinished: data.isFinished,
              status: 'ready',
            },
          };
        }

        // Player reply → immediate; NPC text response → typing delay
        schedulePendingMessage(chatType, data.currentMessage.id);

        return {
          version: data.version,
          finalChoice: chatType === 'MARINA' ? (s.finalChoice ?? null) : s.finalChoice,
          [slotKey(chatType)]: {
            ...current,
            messages: [...current.messages, playerMessage],
            isTyping: true,
            pendingMessage: data.currentMessage,
            isWaiting: data.isWaiting,
            isFinished: data.isFinished,
            status: 'ready',
          },
        };
      });
    } catch (error) {
      console.error('[chatStore.choice]', error);
      toast.error('Ошибка соединения');
      await refresh();
    }
  },

  markRead: (chatType) => {
    set((s) => ({
      [slotKey(chatType)]: {
        ...s[slotKey(chatType)],
        unreadCount: 0,
      },
    }));
  },

  showTriggeredMessage: async (chatType) => {
    try {
      const stateRes = await fetch('/api/chat/state');

      if (!stateRes.ok) {
        return;
      }

      const state = (await stateRes.json()) as StateResponse;
      const slotState = chatType === 'DETECTIVE' ? state.detective : state.marina;
      const currentMsg = slotState.currentMessage;

      if (!currentMsg) {
        return;
      }

      set((s) => {
        const current = s[slotKey(chatType)];
        const lastId = current.messages.at(-1)?.id;

        if (currentMsg.id === lastId) {
          return { version: state.version };
        }

        // No animation when next state is also waiting for a trigger
        if (slotState.isWaiting) {
          return {
            version: state.version,
            [slotKey(chatType)]: {
              ...current,
              messages: [...current.messages, currentMsg],
              unreadCount: current.unreadCount + 1,
              isWaiting: slotState.isWaiting,
              isFinished: slotState.isFinished,
              status: 'ready',
            },
          };
        }

        schedulePendingMessage(chatType, currentMsg.id);

        return {
          version: state.version,
          [slotKey(chatType)]: {
            ...current,
            isTyping: true,
            pendingMessage: currentMsg,
            isWaiting: slotState.isWaiting,
            isFinished: slotState.isFinished,
            status: 'ready',
          },
        };
      });
    } catch (error) {
      console.error('[chatStore.showTriggeredMessage]', error);
    }
  },
}));
