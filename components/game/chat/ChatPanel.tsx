'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

import { useChatStore } from '@/store/chatStore';
import { ChatWindow } from './ChatWindow';
import type { ChatType } from '@/types/chat';

interface ChatPanelProps {
  chatType: ChatType;
}

const CHAT_LABEL: Record<ChatType, string> = {
  DETECTIVE: 'Детектив',
  MARINA: 'Аноним',
};

export function ChatPanel({ chatType }: ChatPanelProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(chatType !== 'MARINA');

  const unreadCount = useChatStore((s) =>
    chatType === 'DETECTIVE' ? s.detective.unreadCount : s.marina.unreadCount,
  );
  const markRead = useChatStore((s) => s.markRead);

  // Reset unread counter whenever the panel is open
  useEffect(() => {
    if (isOpen) {
      markRead(chatType);
    }
  }, [isOpen, chatType, markRead]);

  const hasUnread = !isOpen && unreadCount > 0;

  return (
    <div
      className={[
        'flex flex-col rounded-game-lg border bg-bg-secondary overflow-hidden',
        hasUnread ? 'border-border animate-chat-notify' : 'border-border',
      ].join(' ')}
    >
      {/* Header / toggle bar */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={`chat-window-${chatType}`}
        className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-bg-tertiary transition-colors"
      >
        <div className="relative shrink-0">
          <Image
            src="/assets/img/icon/chat-icon-message.svg"
            alt=""
            width={24}
            height={24}
            aria-hidden="true"
          />
          {hasUnread && (
            <span
              className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] font-bold text-content-inverse"
              aria-label={`${unreadCount} новых сообщений`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>

        <span className="font-mono text-game-panel uppercase tracking-game-wide text-accent">
          {CHAT_LABEL[chatType]}
        </span>

        <div className="min-w-0 flex-1 overflow-hidden" aria-hidden="true">
          <span className="block overflow-hidden whitespace-nowrap font-mono text-game-xs text-border tracking-[-0.05em]">
            {'////////////////////////////////////////////////////////////////////'}
          </span>
        </div>

        <span
          className="font-mono text-game-sm text-accent leading-none"
          aria-hidden="true"
        >
          {isOpen ? '−' : '+'}
        </span>
      </button>

      {/* Chat window */}
      {isOpen && (
        <div
          id={`chat-window-${chatType}`}
          className="flex h-[420px] flex-col p-3"
        >
          <ChatWindow chatType={chatType} />
        </div>
      )}
    </div>
  );
}
