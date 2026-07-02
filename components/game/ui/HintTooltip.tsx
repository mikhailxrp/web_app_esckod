'use client';

import Image from 'next/image';
import type { ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { ParagraphText } from './ParagraphText';

interface HintTooltipProps {
  text: string;
  /** Прямоугольник кнопки-триггера (getBoundingClientRect) — тултип выравнивается по ней */
  anchorRect: DOMRect;
  onClose: () => void;
}

const TOOLTIP_WIDTH = 256; // w-64
const GAP = 8;

/** Тултип «Инструкция» — заголовок + текст с абзацами + кнопка «ОК». Используется в HintButton миссий.
 *  Рендерится порталом в document.body, чтобы не обрезаться overflow-hidden игровой панели. */
export function HintTooltip({ text, anchorRect, onClose }: HintTooltipProps): ReactElement {
  const top = anchorRect.bottom + window.scrollY + GAP;
  const left = anchorRect.right + window.scrollX - TOOLTIP_WIDTH;

  return createPortal(
    <div
      role="tooltip"
      className="absolute z-card w-64 rounded-[8px] bg-white/30 p-3 font-mono shadow-game-card backdrop-blur-[20px]"
      style={{ top, left }}
    >
      <span
        aria-hidden="true"
        className="absolute -top-2 right-[14px] h-0 w-0 border-x-8 border-b-8 border-x-transparent border-b-white/30"
      />

      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-game-xs font-bold uppercase text-white" style={{ letterSpacing: '1.50px' }}  >
          Инструкция
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть подсказку"
          className="shrink-0"
        >
          <Image src="/assets/icons/close.svg" alt="" width={14} height={14} aria-hidden="true" />
        </button>
      </div>

      <div className="text-[13px] leading-[18px] text-white">
        <ParagraphText text={text} />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-3 rounded-game-sm bg-accent px-4 py-1 font-mono text-game-xs font-bold text-content-inverse transition-opacity hover:opacity-80"
      >
        ОК
      </button>
    </div>,
    document.body,
  );
}
