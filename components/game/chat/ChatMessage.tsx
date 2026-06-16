'use client';

import type { ReactNode } from 'react';
import type { ChatAuthor } from '@prisma/client';
import { AudioPlayer } from '@/components/ui/AudioPlayer';
import { TranscriptToggle } from './TranscriptToggle';

interface ChatMessageProps {
  id: string;
  author: ChatAuthor;
  text: string | null;
  audioUrl: string | null;
  isAwaiting?: boolean;
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

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function renderTextWithLinks(text: string): ReactNode[] {
  const parts = text.split(URL_PATTERN);

  return parts.map((part, index) => {
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-accent hover:opacity-80 break-all"
        >
          {part}
        </a>
      );
    }

    return part;
  });
}

export function ChatMessage({
  id,
  author,
  text,
  audioUrl,
  isAwaiting = false,
}: ChatMessageProps): React.ReactElement | null {
  if (!text && !audioUrl) return null;

  const isRight = IS_RIGHT[author];
  const awaitingClass = isAwaiting && !isRight ? 'animate-message-await' : '';

  return (
    <div className={`flex flex-col gap-1 ${isRight ? 'items-end' : 'items-start'}`}>
      <span className="font-mono text-game-xs font-bold uppercase tracking-game-wide text-accent">
        {AUTHOR_LABEL[author]}:
      </span>

      {audioUrl ? (
        <>
          <div
            className={[
              'max-w-[85%] rounded-game-md px-4 py-3',
              isRight ? 'bg-[rgba(164,244,240,0.60)] text-content-inverse' : 'bg-[rgba(255,255,255,0.30)] text-content-primary',
              awaitingClass,
            ].join(' ')}
          >
            <AudioPlayer src={audioUrl} />
          </div>

          {text && <TranscriptToggle text={text} messageId={id} />}
        </>
      ) : (
        <div
          className={[
            'max-w-[85%] rounded-game-md px-4 py-3',
            'font-mono text-game-sm leading-relaxed whitespace-pre-wrap',
            isRight ? 'bg-[rgba(164,244,240,0.60)] text-content-inverse' : 'bg-[rgba(255,255,255,0.30)] text-content-primary',
            awaitingClass,
          ].join(' ')}
        >
          {text ? renderTextWithLinks(text) : null}
        </div>
      )}
    </div>
  );
}
