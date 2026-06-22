'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OnboardingScene } from '@/types/onboarding';
import { ONBOARDING_STEPS } from '@/constants/onboardingSteps';
import { OnboardingTooltip } from './OnboardingTooltip';

interface OnboardingControllerProps {
  playerLogin: string;
  onSceneChange: (scene: OnboardingScene) => void;
  /** Вызывается при каждой смене шага — передаёт step.id для per-step demo-состояния */
  onStepChange?: (stepId: number) => void;
  onComplete: () => void;
}

const TOTAL = ONBOARDING_STEPS.length;

export function OnboardingController({
  playerLogin,
  onSceneChange,
  onStepChange,
  onComplete,
}: OnboardingControllerProps): React.ReactElement {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [completing, setCompleting] = useState(false);
  const rafRef = useRef<number | null>(null);

  const step = ONBOARDING_STEPS[currentIndex];

  /** Пересчитываем targetRect при смене шага */
  const updateTargetRect = useCallback(() => {
    if (!step.target) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(`[data-onboarding-id="${step.target}"]`);
    setTargetRect(el ? el.getBoundingClientRect() : null);
  }, [step.target]);

  useEffect(() => {
    onSceneChange(step.scene);
    onStepChange?.(step.id);
    // Небольшая задержка для случаев когда сцена меняется и DOM перерисовывается
    const timeout = setTimeout(() => {
      updateTargetRect();
    }, 80);
    return () => clearTimeout(timeout);
  }, [step, onSceneChange, onStepChange, updateTargetRect]);

  /** Пересчёт при ресайзе/скролле */
  useEffect(() => {
    const handle = (): void => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateTargetRect);
    };
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [updateTargetRect]);

  /** Блокировка Escape */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const handleNext = useCallback(async (): Promise<void> => {
    const isLast = currentIndex === TOTAL - 1;

    if (isLast) {
      if (completing) return;
      setCompleting(true);
      try {
        await fetch('/api/onboarding/complete', { method: 'POST' });
      } catch {
        // Не блокируем завершение тура при сетевой ошибке
      }
      onComplete();
      return;
    }

    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, completing, onComplete]);

  const handleBack = useCallback((): void => {
    if (currentIndex === 0) return;
    setCurrentIndex((prev) => prev - 1);
  }, [currentIndex]);

  const isLastStep = currentIndex === TOTAL - 1;

  return (
    <OnboardingTooltip
      step={step}
      currentIndex={currentIndex}
      total={TOTAL}
      playerLogin={playerLogin}
      onNext={() => void handleNext()}
      onBack={handleBack}
      targetRect={targetRect}
      isLastStep={isLastStep}
    />
  );
}
