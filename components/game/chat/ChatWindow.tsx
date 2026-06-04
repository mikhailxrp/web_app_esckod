'use client';

import { useEffect, useRef } from 'react';

import { useChatStore } from '@/store/chatStore';
import { ChatMessage } from './ChatMessage';
import { ChatAdvanceButton } from './ChatAdvanceButton';
import { ChatChoices } from './ChatChoices';
import type { ChatAuthor, ChatType } from '@/types/chat';

interface ChatWindowProps {
  chatType: ChatType;
}

const TYPING_AUTHOR_LABEL: Partial<Record<ChatAuthor, string>> = {
  DETECTIVE: 'Детектив',
  MARINA: 'Марина',
  ANONYMOUS: 'Аноним',
};

export function ChatWindow({ chatType }: ChatWindowProps): React.ReactElement {
  const slot = useChatStore((s) =>
    chatType === 'DETECTIVE' ? s.detective : s.marina,
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages appear or typing indicator shows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [slot.messages.length, slot.isTyping]);

  if (slot.status === 'loading' && slot.messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-8" role="status" aria-label="Загрузка чата">
        <span
          className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent"
          aria-hidden="true"
        />
      </div>
    );
  }

  if (slot.status === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8">
        <p className="font-mono text-game-sm text-semantic-error" role="alert">
          Ошибка загрузки чата
        </p>
      </div>
    );
  }

  const lastMessage = slot.messages.at(-1);
  const showChoices =
    !slot.isTyping &&
    !slot.isWaiting &&
    !slot.isFinished &&
    lastMessage?.hasChoices === true &&
    lastMessage.choices !== null &&
    lastMessage.choices.length > 0;

  const showAdvance =
    !slot.isTyping &&
    !slot.isWaiting &&
    !slot.isFinished &&
    !showChoices &&
    slot.messages.length > 0;

  const typingAuthor = slot.pendingMessage?.author;
  const typingLabel = typingAuthor ? (TYPING_AUTHOR_LABEL[typingAuthor] ?? null) : null;

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      {/* Message feed */}
      <div className="chat-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {slot.messages.length === 0 ? (
          <p className="py-4 text-center font-mono text-game-sm text-content-muted" role="status">
            Нет сообщений
          </p>
        ) : (
          slot.messages.map((msg) =>
            msg.text || msg.audioUrl ? (
              <ChatMessage
                key={msg.id}
                id={msg.id}
                author={msg.author}
                text={msg.text}
                audioUrl={msg.audioUrl}
              />
            ) : null,
          )
        )}

        {/* Typing indicator */}
        {slot.isTyping && typingLabel && (
          <div
            className="flex flex-col gap-1"
            role="status"
            aria-live="polite"
            aria-label={`${typingLabel} печатает`}
          >
            <span className="font-mono text-game-xs font-bold uppercase tracking-game-wide text-accent">
              {typingLabel}:
            </span>
            <div className="flex items-center gap-2 max-w-[85%] rounded-game-md px-4 py-3 bg-bg-tertiary">
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-2 rounded-full bg-accent animate-blink"
                    style={{ animationDelay: `${i * 0.3}s` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Affordances */}
      {(showChoices || showAdvance) && (
        <div className="shrink-0 border-t border-border pt-3">
          {showChoices && lastMessage?.choices ? (
            <ChatChoices chatType={chatType} choices={lastMessage.choices} />
          ) : (
            <ChatAdvanceButton chatType={chatType} />
          )}
        </div>
      )}
    </div>
  );
}
