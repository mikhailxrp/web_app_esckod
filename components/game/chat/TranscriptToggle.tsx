'use client';

import { useState } from 'react';

interface TranscriptToggleProps {
  text: string;
  messageId: string;
  letterSpacing?: number;
}

export function TranscriptToggle({ text, messageId, letterSpacing }: TranscriptToggleProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const transcriptId = `transcript-${messageId}`;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={transcriptId}
        onClick={() => setIsOpen((prev) => !prev)}
        className={[
          'self-start font-mono text-game-xs px-3 py-1',
          'rounded-game-full transition-colors duration-200',
          'bg-accent text-content-inverse hover:bg-accent-hover',
        ].join(' ')}
      >
        {isOpen ? 'скрыть текстовую версию' : 'текстовая версия'}
      </button>

      {isOpen && (
        <div
          id={transcriptId}
          role="region"
          aria-label="Расшифровка аудио"
          className="rounded-game-md bg-bg-tertiary px-4 py-3 font-mono text-game-sm leading-relaxed text-content-primary whitespace-pre-wrap"
          style={letterSpacing !== undefined ? { letterSpacing: `${letterSpacing}px` } : undefined}
        >
          {text}
        </div>
      )}
    </div>
  );
}
