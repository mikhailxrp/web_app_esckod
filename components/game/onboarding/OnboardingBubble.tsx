"use client";

import type {
  BubbleAnchor,
  BubbleTailSide,
  BubbleTextAlign,
  TooltipPlacement,
} from "@/types/onboarding";

const BUBBLE_FONT_SIZE = 14;
const BUBBLE_LINE_HEIGHT_RATIO = 1.625;
const BUBBLE_BUTTON_RADIUS = 14;
const BUBBLE_BUTTON_BG = "#44DFD7";
const BUBBLE_LETTER_SPACING = 0;
const BUBBLE_BG = "rgba(255, 255, 255, 0.30)";
const BUBBLE_BLUR = "blur(20px)";
const BUBBLE_TAIL_SIZE = 10;
const BUBBLE_GAP = 12;
const BUBBLE_TAIL_OFFSET = 24;
const BUBBLE_MAX_WIDTH = 340;


const BUBBLE_TRANSITION = 'opacity 150ms ease-in-out';

interface OnboardingBubbleProps {
  stepNumber: number;
  text: string;
  placement: TooltipPlacement;
  bubbleAnchor?: BubbleAnchor;
  bubbleGap?: number;
  bubbleTailSize?: number;
  bubbleTailOffset?: number;
  bubbleTailSide?: BubbleTailSide;
  bubbleShiftX?: number;
  bubbleShiftY?: number;
  bubbleFontSize?: number;
  bubbleLineHeight?: number;
  bubbleLetterSpacing?: number;
  bubbleTextAlign?: BubbleTextAlign;
  targetRect: DOMRect | null;
  isLastStep?: boolean;
  isVisible?: boolean;
  onNext: () => void;
}

interface BubbleLayout {
  tailSize: number;
  tailOffset: number;
  gap: number;
  shiftX: number;
  shiftY: number;
}

function getDefaultAnchor(placement: TooltipPlacement): BubbleAnchor {
  switch (placement) {
    case "top":
      return "top-center";
    case "bottom":
      return "bottom-center";
    case "left":
      return "center-left";
    case "right":
      return "center-right";
    default:
      return "top-center";
  }
}

function getTailSide(placement: TooltipPlacement): BubbleTailSide {
  switch (placement) {
    case "top":
      return "bottom";
    case "bottom":
      return "top";
    case "left":
      return "right";
    case "right":
      return "left";
    default:
      return "bottom";
  }
}

function getAnchorPoint(
  rect: DOMRect,
  anchor: BubbleAnchor,
): { x: number; y: number } {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  switch (anchor) {
    case "top-left":
      return { x: rect.left, y: rect.top };
    case "top-center":
      return { x: cx, y: rect.top };
    case "top-right":
      return { x: rect.right, y: rect.top };
    case "bottom-left":
      return { x: rect.left, y: rect.bottom };
    case "bottom-center":
      return { x: cx, y: rect.bottom };
    case "bottom-right":
      return { x: rect.right, y: rect.bottom };
    case "center-left":
      return { x: rect.left, y: cy };
    case "center-right":
      return { x: rect.right, y: cy };
  }
}

function calcBubblePosition(
  rect: DOMRect | null,
  placement: TooltipPlacement,
  bubbleAnchor?: BubbleAnchor,
  layout: BubbleLayout = {
    tailSize: BUBBLE_TAIL_SIZE,
    tailOffset: BUBBLE_TAIL_OFFSET,
    gap: BUBBLE_GAP,
    shiftX: 0,
    shiftY: 0,
  },
): React.CSSProperties {
  if (!rect || placement === "center") {
    return {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 402,
    };
  }

  const anchor = getAnchorPoint(
    rect,
    bubbleAnchor ?? getDefaultAnchor(placement),
  );
  const style: React.CSSProperties = {
    position: "fixed",
    zIndex: 402,
    maxWidth: BUBBLE_MAX_WIDTH,
  };

  const { tailSize, tailOffset, gap, shiftX, shiftY } = layout;

  switch (placement) {
    case "top":
      style.bottom =
        window.innerHeight - (anchor.y - gap - tailSize - shiftY);
      style.left = Math.max(8, anchor.x - tailOffset + shiftX);
      break;
    case "bottom":
      style.top = anchor.y + gap + tailSize + shiftY;
      style.left = Math.max(8, anchor.x - tailOffset + shiftX);
      break;
    case "right":
      style.left = anchor.x + gap + tailSize + shiftX;
      style.top = anchor.y + shiftY;
      style.transform = "translateY(-50%)";
      break;
    case "left":
      style.right = window.innerWidth - anchor.x + gap + tailSize - shiftX;
      style.top = anchor.y + shiftY;
      style.transform = "translateY(-50%)";
      break;
  }

  return style;
}

function BubbleTail({
  side,
  tailSize,
  tailOffset,
}: {
  side: BubbleTailSide;
  tailSize: number;
  tailOffset: number;
}): React.ReactElement {
  const color = BUBBLE_BG;

  const base: React.CSSProperties = {
    position: "absolute",
    width: 0,
    height: 0,
  };

  switch (side) {
    case "bottom":
      return (
        <div
          aria-hidden="true"
          style={{
            ...base,
            bottom: -tailSize,
            left: tailOffset,
            borderLeft: `${tailSize}px solid transparent`,
            borderRight: `${tailSize}px solid transparent`,
            borderTop: `${tailSize}px solid ${color}`,
          }}
        />
      );
    case "top":
      return (
        <div
          aria-hidden="true"
          style={{
            ...base,
            top: -tailSize,
            left: tailOffset,
            borderLeft: `${tailSize}px solid transparent`,
            borderRight: `${tailSize}px solid transparent`,
            borderBottom: `${tailSize}px solid ${color}`,
          }}
        />
      );
    case "left":
      return (
        <div
          aria-hidden="true"
          style={{
            ...base,
            left: -tailSize,
            top: "50%",
            transform: "translateY(-50%)",
            borderTop: `${tailSize}px solid transparent`,
            borderBottom: `${tailSize}px solid transparent`,
            borderRight: `${tailSize}px solid ${color}`,
          }}
        />
      );
    case "right":
      return (
        <div
          aria-hidden="true"
          style={{
            ...base,
            right: -tailSize,
            top: "50%",
            transform: "translateY(-50%)",
            borderTop: `${tailSize}px solid transparent`,
            borderBottom: `${tailSize}px solid transparent`,
            borderLeft: `${tailSize}px solid ${color}`,
          }}
        />
      );
  }
}

export function OnboardingBubble({
  stepNumber,
  text,
  placement,
  bubbleAnchor,
  bubbleGap,
  bubbleTailSize,
  bubbleTailOffset,
  bubbleTailSide,
  bubbleShiftX,
  bubbleShiftY,
  bubbleFontSize,
  bubbleLineHeight,
  bubbleLetterSpacing,
  bubbleTextAlign,
  targetRect,
  isLastStep = false,
  isVisible = true,
  onNext,
}: OnboardingBubbleProps): React.ReactElement {
  const fontSize = bubbleFontSize ?? BUBBLE_FONT_SIZE;
  const lineHeight =
    bubbleLineHeight ?? Math.round(fontSize * BUBBLE_LINE_HEIGHT_RATIO);
  const letterSpacing = bubbleLetterSpacing ?? BUBBLE_LETTER_SPACING;
  const layout: BubbleLayout = {
    tailSize: bubbleTailSize ?? BUBBLE_TAIL_SIZE,
    tailOffset: bubbleTailOffset ?? BUBBLE_TAIL_OFFSET,
    gap: bubbleGap ?? BUBBLE_GAP,
    shiftX: bubbleShiftX ?? 0,
    shiftY: bubbleShiftY ?? 0,
  };

  const positionStyle = calcBubblePosition(
    targetRect,
    placement,
    bubbleAnchor,
    layout,
  );
  const tailSide = bubbleTailSide ?? getTailSide(placement);

  return (
    <div
      role="dialog"
      aria-label={`Инструктаж, шаг ${stepNumber}`}
      aria-modal="true"
      className="font-mono"
      style={{
        ...positionStyle,
        opacity: isVisible ? 1 : 0,
        transition: BUBBLE_TRANSITION,
      }}
    >
      <div
        className="relative rounded-game-lg"
        style={{
          background: BUBBLE_BG,
          backdropFilter: BUBBLE_BLUR,
          WebkitBackdropFilter: BUBBLE_BLUR,
          padding: "16px 20px",
        }}
      >
        <p
          className="mb-3 whitespace-pre-line text-left"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: `${lineHeight}px`,
            letterSpacing: `${letterSpacing}px`,
            textAlign: bubbleTextAlign ?? "left",
            color: "#ffffff",
          }}
        >
          {text}
        </p>

        <button
          type="button"
          onClick={onNext}
          className="px-5 py-1.5 font-bold text-bg-primary transition-opacity hover:opacity-80"
          style={{
            fontSize: `${fontSize}px`,
            letterSpacing: `${letterSpacing}px`,
            backgroundColor: BUBBLE_BUTTON_BG,
            borderRadius: `${BUBBLE_BUTTON_RADIUS}px`,
          }}
        >
          {isLastStep ? 'завершить инструктаж' : 'далее'}
        </button>

        {placement !== "center" && (
          <BubbleTail
            side={tailSide}
            tailSize={layout.tailSize}
            tailOffset={layout.tailOffset}
          />
        )}
      </div>
    </div>
  );
}
