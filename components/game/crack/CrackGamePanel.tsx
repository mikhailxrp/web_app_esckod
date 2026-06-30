"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";

import { AttemptHistory } from "@/components/game/crack/AttemptHistory";
import { CrackCipherText } from "@/components/game/crack/CrackCipherText";
import { CrackCompletedView } from "@/components/game/crack/CrackCompletedView";
import { CrackHintButton } from "@/components/game/crack/CrackHintButton";
import { CrackSkipButton } from "@/components/game/crack/CrackSkipButton";
import { CrackWordInput } from "@/components/game/crack/CrackWordInput";
import GameLoader from "@/components/ui/GameLoader";
import { toast } from "@/components/ui/Toast";
import { fetchWithVersion } from "@/lib/api/fetchWithVersion";
import { useChatStore } from "@/store/chatStore";
import { useLogStore } from "@/store/logStore";
import type {
  AttemptEntry,
  CrackAttemptResult,
  CrackCompleteResult,
  CrackState,
} from "@/types/crack";
import { ONBOARDING_TARGETS } from "@/constants/onboardingSteps";
import type { CrackDemoState } from "@/types/onboarding";

/** Базовые данные демо-сессии взломщика (нейтральные, не раскрывают целевое слово) */
const DEMO_WORD_LIST = ["ПИЛОТ", "ПЕСНЯ", "ПЛИТА", "МЫШКА", "КАРТА"];
const DEMO_TARGET_URL = "example.ru";
const DEMO_TARGET_EMAIL = "PETROV@CORP.RU";

interface PlayingState {
  wordList: string[];
  attempts: AttemptEntry[];
  attemptsUsed: number;
  maxAttempts: number;
  version: number;
  canSkip: boolean;
  hintText: string | null;
  targetUrl: string | null;
  targetEmail: string | null;
}

interface FailedState {
  newWordList: string[];
  version: number;
  canSkip: boolean;
  prevPlaying: PlayingState;
}

interface CompletedState {
  resultPassword: string | null;
  targetUrl: string | null;
  targetEmail: string | null;
  hintText: string | null;
}

type View =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "playing"; data: PlayingState }
  | { phase: "failed"; data: FailedState }
  | { phase: "completed"; data: CompletedState };

interface CrackGamePanelProps {
  slotKey: string;
  onClose: () => void;
  /** Режим демонстрации в онбординге — не вызывает реальный API */
  demo?: boolean;
  demoState?: CrackDemoState;
}

export function CrackGamePanel({
  slotKey,
  onClose,
  demo = false,
  demoState,
}: CrackGamePanelProps): ReactElement {
  const [view, setView] = useState<View>({ phase: "loading" });
  const [busy, setBusy] = useState(false);
  const [inputWord, setInputWord] = useState("");
  const [noiseVisible, setNoiseVisible] = useState(false);

  const refreshLogs = useLogStore((s) => s.refreshLogs);
  const refreshChat = useChatStore((s) => s.refresh);

  const loadState = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`/api/missions/crack/${slotKey}`);

      if (!res.ok) {
        setView({ phase: "error", message: "Не удалось загрузить миссию." });
        return;
      }

      const data = (await res.json()) as CrackState;

      if (data.isCompleted) {
        setView({
          phase: "completed",
          data: {
            resultPassword: data.resultPassword,
            targetUrl: data.targetUrl,
            targetEmail: data.targetEmail,
            hintText: data.hintText,
          },
        });
        return;
      }

      setView({
        phase: "playing",
        data: {
          wordList: data.wordList,
          attempts: data.attempts,
          attemptsUsed: data.attemptsUsed,
          maxAttempts: data.maxAttempts,
          version: data.version,
          canSkip: data.canSkip,
          hintText: data.hintText,
          targetUrl: data.targetUrl,
          targetEmail: data.targetEmail,
        },
      });
    } catch (error) {
      console.error("[CrackGamePanel.loadState]", error);
      setView({ phase: "error", message: "Ошибка соединения." });
    }
  }, [slotKey]);

  useEffect(() => {
    if (demo) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadState();
  }, [loadState, demo]);

  // Demo: инициализируем view из demoState (не обращаемся к API)
  useEffect(() => {
    if (!demo || !demoState) return;
    if (demoState.phase === "launch") return; // launch рендерит свой блок
    if (demoState.phase === "playing") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInputWord(demoState.inputWord ?? "");
      setView({
        phase: "playing",
        data: {
          wordList: DEMO_WORD_LIST,
          attempts: demoState.attempts ?? [],
          attemptsUsed: demoState.attempts?.length ?? 0,
          maxAttempts: 6,
          version: 0,
          canSkip: false,
          hintText: null,
          targetUrl: DEMO_TARGET_URL,
          targetEmail: DEMO_TARGET_EMAIL,
        },
      });
    } else if (demoState.phase === "completed") {
      setInputWord("");
      setView({
        phase: "completed",
        data: {
          resultPassword: demoState.resultPassword ?? "ПИЛОТ",
          targetUrl: demoState.targetUrl ?? DEMO_TARGET_URL,
          targetEmail: demoState.targetEmail ?? DEMO_TARGET_EMAIL,
          hintText: null,
        },
      });
    }
  }, [demo, demoState]);

  const completeMission = useCallback(
    async (playing: PlayingState): Promise<void> => {
      try {
        const res = await fetch(`/api/missions/crack/${slotKey}/complete`, {
          method: "POST",
        });

        if (!res.ok) {
          toast.error("Не удалось завершить миссию. Обновляю состояние.");
          await loadState();
          return;
        }

        const data = (await res.json()) as CrackCompleteResult;

        setView({
          phase: "completed",
          data: {
            resultPassword: data.resultPassword,
            targetUrl: data.targetUrl,
            targetEmail: data.targetEmail,
            hintText: playing.hintText,
          },
        });

        await Promise.all([refreshLogs(), refreshChat()]);
      } catch (error) {
        console.error("[CrackGamePanel.completeMission]", error);
        toast.error("Ошибка соединения.");
        await loadState();
      }
    },
    [slotKey, loadState, refreshLogs, refreshChat],
  );

  const handleSelectWord = useCallback(
    async (word: string): Promise<void> => {
      if (busy || view.phase !== "playing") return;

      const playing = view.data;
      setBusy(true);

      try {
        const res = await fetchWithVersion(
          `/api/missions/crack/${slotKey}/attempt`,
          {
            body: { word, expectedVersion: playing.version },
            onConflict: loadState,
          },
        );

        if (res.status === 409) {
          return;
        }

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          if (data.error === "WORD_NOT_IN_FIELD") {
            setNoiseVisible(true);
            setTimeout(() => setNoiseVisible(false), 2000);
          } else {
            toast.error("Не удалось сделать попытку.");
          }
          return;
        }

        const result = (await res.json()) as CrackAttemptResult;

        if (result.isCorrect) {
          await completeMission(playing);
          return;
        }

        if (result.isFailed) {
          setView({
            phase: "failed",
            data: {
              newWordList: result.newWordList ?? playing.wordList,
              version: result.version,
              canSkip: result.canSkip ?? playing.canSkip,
              prevPlaying: playing,
            },
          });
          await refreshLogs();
          return;
        }

        setView({
          phase: "playing",
          data: {
            ...playing,
            attempts: [
              ...playing.attempts,
              { word, positions: result.positions },
            ],
            attemptsUsed: result.attemptsUsed,
            version: result.version,
          },
        });
      } catch (error) {
        console.error("[CrackGamePanel.handleSelectWord]", error);
        toast.error("Ошибка соединения.");
      } finally {
        setBusy(false);
      }
    },
    [busy, view, slotKey, loadState, completeMission, refreshLogs],
  );

  const handleRestart = useCallback((): void => {
    if (view.phase !== "failed") return;
    const { data } = view;
    setInputWord("");
    setView({
      phase: "playing",
      data: {
        ...data.prevPlaying,
        wordList: data.newWordList,
        attempts: [],
        attemptsUsed: 0,
        version: data.version,
        canSkip: data.canSkip,
      },
    });
  }, [view]);

  const handleSkip = useCallback(async (): Promise<boolean> => {
    const playing =
      view.phase === "playing"
        ? view.data
        : view.phase === "failed"
          ? view.data.prevPlaying
          : null;

    if (!playing) return false;

    try {
      const res = await fetch(`/api/missions/crack/${slotKey}/skip`, {
        method: "POST",
      });

      if (!res.ok) {
        toast.error("Не удалось пропустить миссию.");
        return false;
      }

      const data = (await res.json()) as CrackCompleteResult;

      setView({
        phase: "completed",
        data: {
          resultPassword: data.resultPassword,
          targetUrl: data.targetUrl,
          targetEmail: data.targetEmail,
          hintText: playing.hintText,
        },
      });

      await Promise.all([refreshLogs(), refreshChat()]);
      return true;
    } catch (error) {
      console.error("[CrackGamePanel.handleSkip]", error);
      toast.error("Ошибка соединения.");
      return false;
    }
  }, [view, slotKey, refreshLogs, refreshChat]);

  const hintText =
    view.phase === "playing"
      ? view.data.hintText
      : view.phase === "failed"
        ? view.data.prevPlaying.hintText
        : view.phase === "completed"
          ? view.data.hintText
          : null;

  const wordleSpotlight =
    demo && demoState?.wordleSpotlight
      ? demoState.wordleSpotlight
      : "word-list";
  const isAttemptPanelSpotlight = wordleSpotlight === "attempt-panel";

  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-game-lg border border-white bg-[rgba(255,255,255,0.08)] pb-6 shadow-game-card"
      aria-label="Взломщик"
      data-onboarding-id={ONBOARDING_TARGETS.CRACK_MISSION_CARD}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <Image
          src="/assets/img/icon/cracker-icon.svg"
          alt=""
          width={30}
          height={30}
          aria-hidden="true"
        />
        <span className="font-mono text-game-panel text-accent">Взломщик</span>

        <div className="min-w-0 flex-1 overflow-hidden">
          <span
            className="ml-auto pr-2 flex h-7 w-[calc(50%+70px)] items-center overflow-hidden whitespace-nowrap font-mono text-xl font-normal leading-none tracking-[-0.3em] text-white/30 select-none [direction:rtl]"
            aria-hidden="true"
          >
            {"/ ".repeat(35)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hintText ? (
            <CrackHintButton hintText={hintText} disabled={demo} />
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть игровое поле"
            className="flex size-7 items-center justify-center rounded-game-sm border border-border transition-colors hover:border-accent"
          >
            <Image
              src="/assets/icons/close.svg"
              alt=""
              width={16}
              height={16}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex">
        {/* Demo: launch phase — форма запуска без реального API */}
        {demo && demoState?.phase === "launch" && (
          <div className="flex flex-1 items-center justify-center px-6 py-8">
            <div className="mx-auto flex w-full max-w-[420px] flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-game-base text-content-secondary">
                  Ссылка
                </span>
                <input
                  readOnly
                  value=""
                  aria-label="Ссылка на сайт"
                  data-onboarding-id={ONBOARDING_TARGETS.CRACK_FORM}
                  className="h-input-height w-full rounded-game-lg border border-border bg-bg-input px-4 font-mono text-game-base text-content-primary focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-game-base text-content-secondary">
                  Почта
                </span>
                <input
                  readOnly
                  value=""
                  aria-label="Почта"
                  className="h-input-height w-full rounded-game-lg border border-border bg-bg-input px-4 font-mono text-game-base text-content-primary focus:outline-none"
                />
              </div>
              <button
                type="button"
                disabled
                className="mt-2 h-input-height w-full rounded-game-full bg-accent font-mono text-game-sm uppercase tracking-game-wide text-content-inverse disabled:opacity-80"
              >
                Начать
              </button>
            </div>
          </div>
        )}

        {view.phase === "loading" &&
          !(demo && demoState?.phase === "launch") && (
            <div className="flex flex-1 items-center justify-center px-6 py-8">
              <GameLoader />
            </div>
          )}

        {view.phase === "error" && (
          <div className="flex flex-1 items-center justify-center px-6 py-8">
            <p
              className="font-mono text-game-sm text-semantic-error"
              role="alert"
            >
              {view.message}
            </p>
          </div>
        )}

        {view.phase === "completed" && (
          <div
            className="flex flex-1 items-center justify-center px-6 py-8"
            data-onboarding-id={ONBOARDING_TARGETS.CRACK_RESULT}
          >
            <CrackCompletedView
              resultPassword={view.data.resultPassword}
              targetUrl={view.data.targetUrl}
              targetEmail={view.data.targetEmail}
              initialCopied={demo && (demoState?.passwordCopied ?? false)}
            />
          </div>
        )}

        {view.phase === "failed" && (
          <div className="flex flex-1 items-center justify-center px-6 py-8">
            <div
              className="flex flex-col items-center gap-5 rounded-game-lg border border-semantic-error bg-bg-primary p-8 text-center shadow-game-card"
              role="alert"
              aria-live="assertive"
            >
              <svg
                width="44"
                height="44"
                viewBox="0 0 44 44"
                fill="none"
                aria-hidden="true"
                className="text-semantic-error"
              >
                <circle cx="22" cy="22" r="21" stroke="currentColor" strokeWidth="2" />
                <path d="M22 12v12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="22" cy="31" r="1.5" fill="currentColor" />
              </svg>

              <div className="flex flex-col gap-1">
                <h2 className="font-mono text-game-panel uppercase tracking-game-wide text-semantic-error">
                  Доступ запрещен
                </h2>
                <p className="font-mono text-game-sm text-content-muted">
                  Миссия провалена.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRestart}
                className="h-input-height w-full max-w-[200px] rounded-game-full bg-accent font-mono text-game-sm uppercase tracking-game-wide text-content-inverse transition-opacity hover:opacity-90"
              >
                Начать заново
              </button>

              {view.data.canSkip ? (
                <div className="flex justify-center">
                  <CrackSkipButton onSkip={handleSkip} disabled={busy} />
                </div>
              ) : null}
            </div>
          </div>
        )}

        {view.phase === "playing" && (
          <>
            {/* Left column: input + attempt history */}
            <div
              className="flex w-[240px] shrink-0 flex-col gap-5 border-r border-border px-5 py-5"
              data-onboarding-id={
                demo && isAttemptPanelSpotlight
                  ? ONBOARDING_TARGETS.CRACK_WORDLE_BOARD
                  : undefined
              }
            >
              <CrackWordInput
                value={inputWord}
                onChange={setInputWord}
                onSelect={(word) => {
                  void handleSelectWord(word);
                  setInputWord("");
                }}
                disabled={busy}
              />

              <AttemptHistory
                attempts={view.data.attempts}
                attemptsUsed={view.data.attemptsUsed}
                maxAttempts={view.data.maxAttempts}
              />

              {view.data.canSkip ? (
                <div className="mt-auto pt-4">
                  <CrackSkipButton onSkip={handleSkip} disabled={busy} />
                </div>
              ) : null}
            </div>

            {/* Right column: cipher text (word list) */}
            <div
              className="w-0 flex-1 p-5"
              data-onboarding-id={
                demo && !isAttemptPanelSpotlight
                  ? ONBOARDING_TARGETS.CRACK_WORDLE_BOARD
                  : undefined
              }
            >
              <CrackCipherText
                words={view.data.wordList}
                onWordClick={setInputWord}
              />
            </div>
          </>
        )}
      </div>
      {/* Noise modal — centered overlay for WORD_NOT_IN_FIELD */}
      {noiseVisible ? (
        <div
          aria-live="assertive"
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="rounded-game-sm border border-border bg-bg-primary px-6 py-4 shadow-game-card">
            <p className="font-mono text-game-sm text-semantic-error">
              Ложная цель. Шум в системе.
            </p>
          </div>
        </div>
      ) : null}
    </article>
  );
}
