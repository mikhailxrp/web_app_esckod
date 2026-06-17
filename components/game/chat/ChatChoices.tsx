"use client";

import { useChatStore } from "@/store/chatStore";
import type { ChatChoice, ChatType } from "@/types/chat";

interface ChatChoicesProps {
  chatType: ChatType;
  choices: ChatChoice[];
}

export function ChatChoices({
  chatType,
  choices,
}: ChatChoicesProps): React.ReactElement {
  const choice = useChatStore((s) => s.choice);
  const status = useChatStore((s) =>
    chatType === "DETECTIVE" ? s.detective.status : s.marina.status,
  );

  const isLoading = status === "loading";

  return (
    <div
      className="flex flex-col gap-2"
      role="group"
      aria-label="Варианты ответа"
    >
      {choices.map((c) => (
        <button
          key={c.value}
          type="button"
          disabled={isLoading}
          onClick={() => void choice(chatType, c.value)}
          aria-label={`Выбрать: ${c.label}`}
          className={[
            'w-full rounded-game-full border border-border bg-bg-secondary px-6 py-2.5',
            'text-left font-accent text-game-sm uppercase tracking-game-wide text-content-primary',
            'whitespace-normal transition-colors duration-200',
            'hover:border-border-strong hover:bg-bg-tertiary',
            'disabled:cursor-not-allowed disabled:opacity-50',
          ].join(' ')}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span
                className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
              {c.label}
            </span>
          ) : (
            c.label
          )}
        </button>
      ))}
    </div>
  );
}
