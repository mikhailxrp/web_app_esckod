'use client';

import type { ChatAuthor } from '@prisma/client';

interface ChatMessageProps {
  author: ChatAuthor;
  text: string | null;
}

const AUTHOR_LABEL: Record<ChatAuthor, string> = {
  DETECTIVE: 'Детектив',
  PLAYER: 'Агент',
  MARINA: 'Марина',
  ANONYMOUS: 'Аноним',
};

// Left-aligned: DETECTIVE, MARINA, ANONYMOUS
// Right-aligned: PLAYER
const IS_RIGHT: Record<ChatAuthor, boolean> = {
  DETECTIVE: false,
  MARINA: false,
  ANONYMOUS: false,
  PLAYER: true,
};

export function ChatMessage({ author, text }: ChatMessageProps): React.ReactElement | null {
  if (!text) return null;

  const isRight = IS_RIGHT[author];

  return (
    <div className={`flex flex-col gap-1 ${isRight ? 'items-end' : 'items-start'}`}>
      <span className="font-mono text-game-xs font-bold uppercase tracking-game-wide text-accent">
        {AUTHOR_LABEL[author]}:
      </span>

      <div
        className={[
          'max-w-[85%] rounded-game-md px-4 py-3',
          'font-mono text-game-sm leading-relaxed whitespace-pre-wrap',
          isRight
            ? 'bg-accent text-content-inverse'
            : 'bg-bg-tertiary text-content-primary',
        ].join(' ')}
      >
        {text}
      </div>
    </div>
  );
}
