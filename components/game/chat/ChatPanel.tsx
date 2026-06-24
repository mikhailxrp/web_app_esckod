"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { useChatStore } from "@/store/chatStore";
import { ChatWindow } from "./ChatWindow";
import type { ChatType } from "@/types/chat";

interface ChatPanelProps {
  chatType: ChatType;
  /** Demo «Детектив печатает…» в онбординге (шаг 22) */
  demoTyping?: boolean;
}

const CHAT_LABEL: Record<ChatType, string> = {
  DETECTIVE: "Детектив",
  MARINA: "Аноним",
};

export function ChatPanel({
  chatType,
  demoTyping = false,
}: ChatPanelProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(chatType !== "MARINA");

  const slot = useChatStore((s) =>
    chatType === "DETECTIVE" ? s.detective : s.marina,
  );
  const markRead = useChatStore((s) => s.markRead);

  // Reset unread counter whenever the panel is open
  useEffect(() => {
    if (isOpen) {
      markRead(chatType);
    }
  }, [isOpen, chatType, markRead]);

  const hasUnread = !isOpen && slot.unreadCount > 0;

  const lastMessage = slot.messages.at(-1);
  const showChoices =
    !slot.isTyping &&
    !slot.isWaiting &&
    !slot.isFinished &&
    lastMessage?.hasChoices === true &&
    lastMessage.choices !== null &&
    lastMessage.choices.length > 0;

  const awaitingAdvance =
    isOpen &&
    !slot.isTyping &&
    !slot.isWaiting &&
    !slot.isFinished &&
    !showChoices &&
    slot.messages.length > 0;

  const shouldPulse = hasUnread || awaitingAdvance;
  const borderClass =
    chatType === "DETECTIVE" ? "border-white" : "border-border";
  const windowHeightClass =
    chatType === "DETECTIVE" ? "h-[450px]" : "h-[500px]";

  return (
    <div
      className={[
        "flex flex-col rounded-game-lg border bg-[rgba(255,255,255,0.08)] backdrop-blur-sm overflow-hidden",
        borderClass,
        shouldPulse ? "animate-chat-notify" : "",
      ].join(" ")}
    >
      {/* Header / toggle bar */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={`chat-window-${chatType}`}
        className="relative flex w-full items-center gap-2 px-3 py-2.5 transition-colors hover:bg-bg-tertiary"
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
              aria-label={`${slot.unreadCount} новых сообщений`}
            >
              {slot.unreadCount > 9 ? "9+" : slot.unreadCount}
            </span>
          )}
        </div>

        <span className="font-mono text-game-panel text-accent">
          {CHAT_LABEL[chatType]}
        </span>

        <div className="min-w-0 flex-1 overflow-hidden" aria-hidden="true">
          <span
            className="ml-auto block h-3 w-1/2 [background:repeating-linear-gradient(-60deg,transparent_0,transparent_8px,rgba(255,255,255,0.3)_8px,rgba(255,255,255,0.3)_10px)]"
            aria-hidden="true"
          />
        </div>

        <span className="relative block h-5 w-5" aria-hidden="true">
          <span
            className={[
              "absolute left-1/2 top-1/2 h-[2px] w-4 -translate-x-1/2 -translate-y-1/2 bg-accent",
              isOpen ? "w-5" : "",
            ].join(" ")}
          />
          {!isOpen ? (
            <span className="absolute left-1/2 top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-accent" />
          ) : null}
        </span>
        <span
          className="pointer-events-none absolute bottom-0 left-3 right-3 h-px rounded-full bg-white"
          aria-hidden="true"
        />
      </button>

      {/* Chat window */}
      {isOpen && (
        <div
          id={`chat-window-${chatType}`}
          className={`flex ${windowHeightClass} flex-col p-3 [background:radial-gradient(ellipse_at_50%_50%,rgba(68,223,215,0.20)_0%,transparent_70%)]`}
        >
          <ChatWindow chatType={chatType} demoTyping={demoTyping} />
        </div>
      )}
    </div>
  );
}
