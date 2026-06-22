"use client";

import type { OnboardingStep } from "@/types/onboarding";
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

const MISSION_TILES_OVERLAY_TEXT_SIZE_STEP_1 = 20;
const MISSION_TILES_OVERLAY_TEXT_SIZE_STEP_2 = 14;

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
  onNext,
  isVisible,
}: {
  stepNumber: number;
  resolvedText: string;
  targetRect: DOMRect | null;
  textFontSize: number;
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
      <div className="flex h-full flex-col items-center justify-center gap-6 px-8 py-10 text-center">
        <p
          className="whitespace-pre-line leading-relaxed text-content-primary"
          style={{ fontSize: `${textFontSize}px`, fontFamily: "inherit" }}
        >
          {resolvedText}
        </p>

        <button
          type="button"
          onClick={onNext}
          className="px-8 py-2.5 font-bold text-bg-primary transition-opacity hover:opacity-80"
          style={{
            fontSize: "20px",
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
          currentIndex === 1
            ? MISSION_TILES_OVERLAY_TEXT_SIZE_STEP_2
            : MISSION_TILES_OVERLAY_TEXT_SIZE_STEP_1
        }
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
      targetRect={targetRect}
      isLastStep={isLastStep}
      onNext={onNext}
      isVisible={isVisible}
    />
  );
}
