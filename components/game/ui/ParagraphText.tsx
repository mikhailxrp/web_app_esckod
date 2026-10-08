import type { ReactElement, ReactNode } from 'react';

interface ParagraphTextProps {
  text: string;
  className?: string;
  /** Превращать URL (http/https) в кликабельные ссылки, открываемые в новой вкладке. */
  linkify?: boolean;
}

const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)»\]]+$/;

/** Разбивает строку на текст и ссылки; закрывающая пунктуация в ссылку не входит. */
function renderWithLinks(paragraph: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of paragraph.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const url = match[0].replace(TRAILING_PUNCTUATION, '');
    if (!url) continue;

    if (start > lastIndex) nodes.push(paragraph.slice(lastIndex, start));
    nodes.push(
      <a
        key={start}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 transition-opacity hover:opacity-80"
      >
        {url}
      </a>,
    );
    lastIndex = start + url.length;
  }

  if (lastIndex < paragraph.length) nodes.push(paragraph.slice(lastIndex));
  return nodes;
}

/** Разбивает текст на абзацы по пустой строке; одиночные переносы внутри абзаца сохраняются. */
export function ParagraphText({ text, className, linkify = false }: ParagraphTextProps): ReactElement {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className={`whitespace-pre-line ${index > 0 ? 'mt-2' : ''} ${className ?? ''}`}>
          {linkify ? renderWithLinks(paragraph) : paragraph}
        </p>
      ))}
    </>
  );
}
