'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { OnboardingScene } from '@/types/onboarding';
import { ONBOARDING_STEPS } from '@/constants/onboardingSteps';
import { OnboardingTooltip } from './OnboardingTooltip';

/** Длительность fade-out перед сменой шага (мс) */
const FADE_OUT_MS = 100;
/** Задержка после смены шага — даём DOM перерисоваться (мс) */
const FADE_SETTLE_MS = 80;

interface OnboardingControllerProps {
  playerLogin: string;
  onSceneChange: (scene: OnboardingScene) => void;
  /** Вызывается при каждой смене шага — передаёт step.id для per-step demo-состояния */
  onStepChange?: (stepId: number) => void;
  onComplete: () => void;
}

const TOTAL = ONBOARDING_STEPS.length;

function measureTarget(target: string | undefined): DOMRect | null {
  if (!target) return null;
  const el = document.querySelector(`[data-onboarding-id="${target}"]`);
  return el ? (el as HTMLElement).getBoundingClientRect() : null;
}

export function OnboardingController({
  playerLogin,
  onSceneChange,
  onStepChange,
  onComplete,
}: OnboardingControllerProps): React.ReactElement {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [completing, setCompleting] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const rafRef = useRef<number | null>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTargetRef = useRef<string | undefined>(undefined);
  const prevSceneRef = useRef<OnboardingScene | undefined>(undefined);

  const step = ONBOARDING_STEPS[currentIndex];

  /** Пересчитываем targetRect при смене шага */
  const updateTargetRect = useCallback(() => {
    setTargetRect(measureTarget(step.target));
  }, [step.target]);

  /**
   * Первый маунт: измеряем синхронно до первой отрисовки браузером,
   * чтобы оверлей не мигнул на центральной позиции.
   */
  useLayoutEffect(() => {
    const rect = measureTarget(step.target);
    if (rect) setTargetRect(rect);
    prevTargetRef.current = step.target;
    prevSceneRef.current = step.scene;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onSceneChange(step.scene);
    onStepChange?.(step.id);

    const targetChanged = prevTargetRef.current !== step.target;
    const sceneChanged = prevSceneRef.current !== step.scene;
    prevTargetRef.current = step.target;
    prevSceneRef.current = step.scene;

    // Задержка нужна только когда сцена или таргет сменились — DOM мог перерисоваться.
    // Если сцена и таргет те же (например, шаги 1→2), повторный замер не нужен.
    if (!targetChanged && !sceneChanged) return;

    const timeout = setTimeout(() => {
      updateTargetRect();
    }, 80);
    return () => clearTimeout(timeout);
  }, [step, onSceneChange, onStepChange, updateTargetRect]);

  /** Cleanup таймера перехода при анмаунте */
  useEffect(() => {
    return () => {
      if (transitionRef.current !== null) clearTimeout(transitionRef.current);
    };
  }, []);

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

  /** Пузырёк не перемещается — target и scene совпадают у обоих шагов */
  const isSamePosition = useCallback((fromIndex: number, toIndex: number): boolean => {
    const from = ONBOARDING_STEPS[fromIndex];
    const to = ONBOARDING_STEPS[toIndex];
    return from.target === to.target && from.scene === to.scene;
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

    if (isSamePosition(currentIndex, currentIndex + 1)) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    if (transitionRef.current !== null) clearTimeout(transitionRef.current);
    setIsVisible(false);
    transitionRef.current = setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      transitionRef.current = setTimeout(() => {
        setIsVisible(true);
      }, FADE_SETTLE_MS);
    }, FADE_OUT_MS);
  }, [currentIndex, completing, onComplete, isSamePosition]);

  const handleBack = useCallback((): void => {
    if (currentIndex === 0) return;

    if (isSamePosition(currentIndex, currentIndex - 1)) {
      setCurrentIndex((prev) => prev - 1);
      return;
    }

    if (transitionRef.current !== null) clearTimeout(transitionRef.current);
    setIsVisible(false);
    transitionRef.current = setTimeout(() => {
      setCurrentIndex((prev) => prev - 1);
      transitionRef.current = setTimeout(() => {
        setIsVisible(true);
      }, FADE_SETTLE_MS);
    }, FADE_OUT_MS);
  }, [currentIndex, isSamePosition]);

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
      isVisible={isVisible}
    />
  );
}
