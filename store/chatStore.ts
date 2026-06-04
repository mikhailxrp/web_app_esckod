'use client';

import { create } from 'zustand';

import { fetchWithVersion } from '@/lib/api/fetchWithVersion';
import { toast } from '@/components/ui/Toast';
import type { ChatMessageView, ChatType } from '@/types/chat';

// =============================================================
// Types
// =============================================================

type SlotStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ChatSlotState {
  messages: ChatMessageView[];
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
  isWaiting: false,
  isFinished: false,
  isVisible: false,
  status: 'idle',
};

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

      set({
        version: state.version,
        finalChoice: state.finalChoice,
        detective: {
          messages: detectiveMessages,
          isWaiting: state.detective.isWaiting,
          isFinished: state.detective.isFinished,
          isVisible: true,
          status: 'ready',
        },
        marina: {
          messages: marinaMessages,
          isWaiting: state.marina.isWaiting,
          isFinished: state.marina.isFinished,
          isVisible: state.marina.isVisible,
          status: 'ready',
        },
        error: null,
      });
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
      [chatType === 'DETECTIVE' ? 'detective' : 'marina']: {
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
          [chatType === 'DETECTIVE' ? 'detective' : 'marina']: {
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
        const current = chatType === 'DETECTIVE' ? s.detective : s.marina;
        const lastId = current.messages.at(-1)?.id;
        const shouldAppend = data.currentMessage.id !== lastId;

        return {
          version: data.version,
          [chatType === 'DETECTIVE' ? 'detective' : 'marina']: {
            ...current,
            messages: shouldAppend
              ? [...current.messages, data.currentMessage]
              : current.messages,
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
      [chatType === 'DETECTIVE' ? 'detective' : 'marina']: {
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
          [chatType === 'DETECTIVE' ? 'detective' : 'marina']: {
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
        const current = chatType === 'DETECTIVE' ? s.detective : s.marina;
        const lastId = current.messages.at(-1)?.id;
        const shouldAppend = data.currentMessage.id !== lastId;

        return {
          version: data.version,
          finalChoice: chatType === 'MARINA' ? (s.finalChoice ?? null) : s.finalChoice,
          [chatType === 'DETECTIVE' ? 'detective' : 'marina']: {
            ...current,
            messages: shouldAppend
              ? [...current.messages, data.currentMessage]
              : current.messages,
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
}));
