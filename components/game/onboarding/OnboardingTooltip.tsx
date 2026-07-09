"use client";

import type { BubbleTextAlign, OnboardingStep } from "@/types/onboarding";
import { MISSION_TILES_OVERLAY_STEP_COUNT } from "@/constants/onboardingSteps";
import { OnboardingBubble } from "./OnboardingBubble";

interface OnboardingTooltipProps {
  step: OnboardingStep;
  /** 0-based */
  currentIndex: number;
  total: number;
  playerLogin: string;
  onNext: () => void;
  onBack: () => void;
  targetRect: DOMRect | null;
  isLastStep: boolean;
  isVisible: boolean;
}

function resolveText(text: string, playerLogin: string): string {
  return text.replace("{{login}}", playerLogin);
}

function getMissionTilesOverlayStyle(
  targetRect: DOMRect | null,
): React.CSSProperties {
  if (targetRect) {
    return {
      position: "fixed",
      top: targetRect.top,
      left: targetRect.left,
      width: targetRect.width,
      height: targetRect.height,
    };
  }

  return {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 520,
  };
}

const BUBBLE_TRANSITION = 'opacity 150ms ease-in-out';

function MissionTilesOverlayStep({
  stepNumber,
  resolvedText,
  targetRect,
  textFontSize,
  textLineHeight,
  textLetterSpacing,
  textAlign,
  centerTextVertically,
  onNext,
  isVisible,
}: {
  stepNumber: number;
  resolvedText: string;
  targetRect: DOMRect | null;
  textFontSize: number;
  textLineHeight: number;
  textLetterSpacing: number;
  textAlign: BubbleTextAlign;
  centerTextVertically: boolean;
  onNext: () => void;
  isVisible: boolean;
}): React.ReactElement {
  return (
    <div
      role="dialog"
      aria-label={`Инструктаж, шаг ${stepNumber}`}
      aria-modal="true"
      className="rounded-game-lg font-mono"
      style={{
        ...getMissionTilesOverlayStyle(targetRect),
        zIndex: 402,
        background: "rgba(255, 255, 255, 0.30)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        opacity: isVisible ? 1 : 0,
        transition: BUBBLE_TRANSITION,
      }}
    >
      <div className="flex h-full flex-col items-center px-8 pt-10 pb-4">
        <div
          className={`flex w-full ${
            centerTextVertically ? "flex-1 items-center justify-center" : ""
          }`}
        >
          <p
            className="whitespace-pre-line text-content-primary"
            style={{
              fontSize: `${textFontSize}px`,
              lineHeight: `${textLineHeight}px`,
              letterSpacing: `${textLetterSpacing}px`,
              textAlign,
              fontFamily: "inherit",
            }}
          >
            {resolvedText}
          </p>
        </div>

        <button
          type="button"
          onClick={onNext}
          className="mt-auto px-8 py-2.5 font-bold text-bg-primary transition-opacity hover:opacity-80"
          style={{
            fontSize: "14px",
            backgroundColor: "#44DFD7",
            borderRadius: "50px",
          }}
        >
          Далее
        </button>
      </div>
    </div>
  );
}

export function OnboardingTooltip({
  step,
  currentIndex,
  playerLogin,
  onNext,
  targetRect,
  isLastStep,
  isVisible,
}: OnboardingTooltipProps): React.ReactElement {
  const stepNumber = currentIndex + 1;
  const resolvedText = resolveText(step.text, playerLogin);

  if (currentIndex < MISSION_TILES_OVERLAY_STEP_COUNT) {
    return (
      <MissionTilesOverlayStep
        stepNumber={stepNumber}
        resolvedText={resolvedText}
        targetRect={targetRect}
        textFontSize={
          step.bubbleFontSize ?? 14
        }
        textLineHeight={step.bubbleLineHeight ?? 22}
        textLetterSpacing={step.bubbleLetterSpacing ?? 0}
        textAlign={step.bubbleTextAlign ?? "center"}
        centerTextVertically={currentIndex === 0}
        onNext={onNext}
        isVisible={isVisible}
      />
    );
  }

  return (
    <OnboardingBubble
      stepNumber={stepNumber}
      text={resolvedText}
      placement={step.placement}
      bubbleAnchor={step.bubbleAnchor}
      bubbleGap={step.bubbleGap}
      bubbleTailSize={step.bubbleTailSize}
      bubbleTailOffset={step.bubbleTailOffset}
      bubbleTailSide={step.bubbleTailSide}
      bubbleShiftX={step.bubbleShiftX}
      bubbleShiftY={step.bubbleShiftY}
      bubbleFontSize={step.bubbleFontSize}
      bubbleLineHeight={step.bubbleLineHeight}
      bubbleLetterSpacing={step.bubbleLetterSpacing}
      bubbleTextAlign={step.bubbleTextAlign}
      targetRect={targetRect}
      isLastStep={isLastStep}
      onNext={onNext}
      isVisible={isVisible}
    />
  );
}
