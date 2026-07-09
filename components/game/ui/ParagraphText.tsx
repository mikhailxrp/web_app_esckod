import type { ReactElement } from 'react';

interface ParagraphTextProps {
  text: string;
  className?: string;
}

/** Разбивает текст на абзацы по пустой строке; одиночные переносы внутри абзаца сохраняются. */
export function ParagraphText({ text, className }: ParagraphTextProps): ReactElement {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className={`whitespace-pre-line ${index > 0 ? 'mt-2' : ''} ${className ?? ''}`}>
          {paragraph}
        </p>
      ))}
    </>
  );
}
