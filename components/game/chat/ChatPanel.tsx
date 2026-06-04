'use client';

import { useState } from 'react';
import Image from 'next/image';

import { ChatWindow } from './ChatWindow';
import type { ChatType } from '@/types/chat';

interface ChatPanelProps {
  chatType: ChatType;
}

const CHAT_LABEL: Record<ChatType, string> = {
  DETECTIVE: 'Детектив',
  MARINA: 'Марина',
};

export function ChatPanel({ chatType }: ChatPanelProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="flex flex-col rounded-game-md border border-border bg-bg-secondary overflow-hidden">
      {/* Header / toggle bar */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={`chat-window-${chatType}`}
        className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-bg-tertiary transition-colors"
      >
        <Image
          src="/assets/img/icon/chat-icon-message.svg"
          alt=""
          width={24}
          height={24}
          aria-hidden="true"
        />

        <span className="font-mono text-game-sm uppercase tracking-game-wide text-content-primary">
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
