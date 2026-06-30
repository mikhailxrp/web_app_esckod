"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";

import { DecipherCompletedView } from "@/components/game/decipher/DecipherCompletedView";
import { DecipherHintButton } from "@/components/game/decipher/DecipherHintButton";
import { DecipherInput } from "@/components/game/decipher/DecipherInput";
import { DecipherSkipButton } from "@/components/game/decipher/DecipherSkipButton";
import { PlayfairTable } from "@/components/game/decipher/PlayfairTable";
import { VigenereView } from "@/components/game/decipher/VigenereView";
import { toast } from "@/components/ui/Toast";
import { buildPlayfairTable } from "@/lib/decipher/playfair";
import { useChatStore } from "@/store/chatStore";
import { useLogStore } from "@/store/logStore";
import type {
  DecipherAttemptResult,
  DecipherCompleteResult,
  DecipherState,
} from "@/types/decipher";
import type { CipherType } from "@prisma/client";
import { ONBOARDING_TARGETS } from "@/constants/onboardingSteps";
import type { DecipherDemoState } from "@/types/onboarding";

interface PlayingState {
  cipherType: CipherType;
  encryptedWord: string;
  cipherKey: string;
  folderName: string | null;
  playfairTable?: string[][];
  vigenereDigits?: number[];
  hintText: string | null;
  canSkip: boolean;
}

interface CompletedState {
  folderPath: string | null;
  folderPassword: string | null;
  hintText: string | null;
}

type View =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "playing"; data: PlayingState }
  | { phase: "failed"; data: PlayingState }
  | { phase: "completed"; data: CompletedState };

interface DecipherGamePanelProps {
  slotKey: string;
  onClose: () => void;
  /** Режим демонстрации в онбординге — не вызывает реальный API */
  demo?: boolean;
  demoState?: DecipherDemoState;
}

export function DecipherGamePanel({
  slotKey,
  onClose,
  demo = false,
  demoState,
}: DecipherGamePanelProps): ReactElement {
  const [view, setView] = useState<View>({ phase: "loading" });
  const [busy, setBusy] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const refreshLogs = useLogStore((s) => s.refreshLogs);
  const refreshChat = useChatStore((s) => s.refresh);

  const loadState = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`/api/missions/decipher/${slotKey}`);

      if (!res.ok) {
        setView({ phase: "error", message: "Не удалось загрузить миссию." });
        return;
      }

      const data = (await res.json()) as DecipherState;

      if (data.isCompleted) {
        setView({
          phase: "completed",
          data: {
            folderPath: data.folderPath,
            folderPassword: data.folderPassword,
            hintText: data.hintText,
          },
        });
        return;
      }

      setView({
        phase: "playing",
        data: {
          cipherType: data.cipherType,
          encryptedWord: data.encryptedWord,
          cipherKey: data.cipherKey,
          folderName: data.folderName,
          playfairTable: data.playfairTable,
          vigenereDigits: data.vigenereDigits,
          hintText: data.hintText,
          canSkip: false,
        },
      });
    } catch (error) {
      console.error("[DecipherGamePanel.loadState]", error);
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
    if (demoState.phase === "launch") return;
    if (demoState.phase === "playing") {
      const cipherKey = demoState.cipherKey ?? "КЛЮЧ";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInputValue(demoState.inputWord ?? "");
      setView({
        phase: "playing",
        data: {
          cipherType: "PLAYFAIR",
          encryptedWord: demoState.encryptedWord ?? "ЛМОПРС",
          cipherKey,
          folderName: demoState.folderName ?? "File_name.zip",
          playfairTable:
            demoState.playfairTable ?? buildPlayfairTable(cipherKey),
          hintText: null,
          canSkip: false,
        },
      });
    } else if (demoState.phase === "completed") {
      setInputValue("");
      setView({
        phase: "completed",
        data: {
          folderPath: demoState.folderPath ?? "PXGUDKXAXA",
          folderPassword: demoState.folderPassword ?? "РАКЕТА",
          hintText: null,
        },
      });
    }
  }, [demo, demoState]);

  const completeMission = useCallback(
    async (hintText: string | null): Promise<void> => {
      try {
        const res = await fetch(`/api/missions/decipher/${slotKey}/complete`, {
          method: "POST",
        });

        if (!res.ok) {
          toast.error("Не удалось завершить миссию. Обновляю состояние.");
          await loadState();
          return;
        }

        const data = (await res.json()) as DecipherCompleteResult;

        setView({
          phase: "completed",
          data: {
            folderPath: data.folderPath,
            folderPassword: data.folderPassword,
            hintText,
          },
        });

        await Promise.all([refreshLogs(), refreshChat()]);
      } catch (error) {
        console.error("[DecipherGamePanel.completeMission]", error);
        toast.error("Ошибка соединения.");
        await loadState();
      }
    },
    [slotKey, loadState, refreshLogs, refreshChat],
  );

  const handleSubmit = useCallback(
    async (decryptedWord: string): Promise<void> => {
      if (demo || busy || view.phase !== "playing") return;

      const playing = view.data;
      setBusy(true);

      try {
        const res = await fetch(`/api/missions/decipher/${slotKey}/attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decryptedWord }),
        });

        if (!res.ok) {
          toast.error("Не удалось сделать попытку.");
          return;
        }

        const result = (await res.json()) as DecipherAttemptResult;

        if (result.isCorrect) {
          await completeMission(playing.hintText);
          return;
        }

        setView({ phase: "failed", data: { ...playing, canSkip: result.canSkip } });
      } catch (error) {
        console.error("[DecipherGamePanel.handleSubmit]", error);
        toast.error("Ошибка соединения.");
      } finally {
        setBusy(false);
      }
    },
    [busy, view, slotKey, completeMission, demo],
  );

  const handleRestart = useCallback((): void => {
    if (view.phase !== "failed") return;
    setInputValue("");
    setView({ phase: "playing", data: view.data });
  }, [view]);

  const handleSkip = useCallback(async (): Promise<boolean> => {
    if (demo) return false;
    const playing =
      view.phase === "playing" ? view.data
      : view.phase === "failed" ? view.data
      : null;
    if (!playing) return false;

    try {
      const res = await fetch(`/api/missions/decipher/${slotKey}/skip`, {
        method: "POST",
      });

      if (!res.ok) {
        toast.error("Не удалось пропустить миссию.");
        return false;
      }

      const data = (await res.json()) as DecipherCompleteResult;

      setView({
        phase: "completed",
        data: {
          folderPath: data.folderPath,
          folderPassword: data.folderPassword,
          hintText: playing.hintText,
        },
      });

      await Promise.all([refreshLogs(), refreshChat()]);
      return true;
    } catch (error) {
      console.error("[DecipherGamePanel.handleSkip]", error);
      toast.error("Ошибка соединения.");
      return false;
    }
  }, [view, slotKey, refreshLogs, refreshChat, demo]);

  const hintText =
    view.phase === "playing" ? view.data.hintText
    : view.phase === "failed" ? view.data.hintText
    : view.phase === "completed" ? view.data.hintText
    : null;

  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-game-lg border border-white bg-[rgba(255,255,255,0.08)] pb-6 shadow-game-card"
      aria-label="Дешифратор"
      data-onboarding-id={ONBOARDING_TARGETS.DECIPHER_MISSION_CARD}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <Image
          src="/assets/img/icon/decoder-icon.svg"
          alt=""
          width={30}
          height={30}
          aria-hidden="true"
        />
        <span className="font-mono text-game-panel text-accent">
          Дешифратор
        </span>

        <div className="min-w-0 flex-1 overflow-hidden">
          <span
            className="ml-auto pr-2 flex h-7 w-[calc(50%+70px)] items-center overflow-hidden whitespace-nowrap font-mono text-xl font-normal leading-none tracking-[-0.3em] text-white/30 select-none [direction:rtl]"
            aria-hidden="true"
          >
            {"/ ".repeat(30)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <DecipherHintButton hintText={hintText} disabled={demo} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть дешифратор"
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
      <div className="flex min-h-[360px]">
        {/* Demo: launch phase — форма запуска без реального API */}
        {demo && demoState?.phase === "launch" && (
          <div className="flex flex-1 items-center justify-center px-6 py-8">
            <div className="mx-auto flex w-full max-w-[420px] flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-game-base text-content-secondary">
                  Ссылка / путь
                </span>
                <input
                  readOnly
                  value=""
                  aria-label="Ссылка или путь к папке"
                  data-onboarding-id={ONBOARDING_TARGETS.DECIPHER_FORM}
                  className="h-input-height w-full rounded-game-lg border border-border bg-bg-input px-4 font-mono text-game-base text-content-primary focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-game-base text-content-secondary">
                  Ключ
                </span>
                <input
                  readOnly
                  value=""
                  aria-label="Ключ шифрования"
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
            <div
              className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-8"
              role="status"
              aria-label="Загрузка"
              aria-busy="true"
            >
              <p className="font-mono text-game-base tracking-game-wide text-content-primary">
                Идентификация типа шифра
              </p>
              <div className="relative h-2 w-progress-width overflow-hidden rounded-game-full border border-border/60 bg-bg-secondary">
                <div className="decipher-loading-fill absolute inset-y-0 left-0 rounded-game-full bg-accent shadow-game-glow-md" />
              </div>
              <style>{`
              @keyframes decipher-progress {
                0%   { width: 0% }
                50%  { width: 65% }
                75%  { width: 80% }
                90%  { width: 87% }
                100% { width: 92% }
              }
              .decipher-loading-fill {
                animation: decipher-progress 2.8s cubic-bezier(0.05, 0.85, 0.2, 1) forwards;
              }
            `}</style>
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
                  <DecipherSkipButton onSkip={handleSkip} disabled={busy} />
                </div>
              ) : null}
            </div>
          </div>
        )}

        {view.phase === "completed" && (
          <div
            className="flex flex-1 items-center justify-center px-6 py-8"
            data-onboarding-id={ONBOARDING_TARGETS.DECIPHER_RESULT}
          >
            <DecipherCompletedView
              folderPath={view.data.folderPath}
              folderPassword={view.data.folderPassword}
              initialCopied={demo && (demoState?.passwordCopied ?? false)}
            />
          </div>
        )}

        {view.phase === "playing" && (
          <>
            {/* Left column */}
            <div className="flex w-[240px] shrink-0 flex-col gap-5 border-r border-border px-5 py-5">
              {/* File icon */}
              <div className="flex items-center gap-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-game-sm border border-border bg-bg-input">
                  <Image
                    src="/assets/icons/file.svg"
                    alt=""
                    width={16}
                    height={16}
                    aria-hidden="true"
                  />
                </div>
                <span className="font-mono text-[14px] text-white">
                  {view.data.folderName ?? "File_name.zip"}
                </span>
              </div>

              {/* Encrypted word */}
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-game-sm text-content-secondary">
                  Зашифрованное слово
                </span>
                <input
                  readOnly
                  value={view.data.encryptedWord}
                  aria-label="Зашифрованное слово"
                  className="h-input-height w-full rounded-game-lg border border-border bg-bg-input px-4 font-mono text-game-base uppercase text-content-primary focus:outline-none"
                />
              </div>

              {/* Decrypted word input */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="decipher-decrypted-word"
                  className="font-mono text-game-sm text-content-secondary"
                >
                  Расшифрованное слово
                </label>
                <DecipherInput
                  onSubmit={handleSubmit}
                  isLoading={busy}
                  isError={false}
                  disabled={busy}
                  externalValue={inputValue}
                  onExternalChange={(val) => {
                    setInputValue(val);
                  }}
                />
              </div>

              {/* Skip button */}
              {view.data.canSkip ? (
                <div className="mt-auto pt-2">
                  <DecipherSkipButton onSkip={handleSkip} disabled={busy} />
                </div>
              ) : null}
            </div>

            {/* Right column */}
            <div
              className="flex flex-1 items-center justify-center p-6"
              data-onboarding-id={ONBOARDING_TARGETS.DECIPHER_TABLE}
            >
              {view.data.cipherType === "PLAYFAIR" &&
              view.data.playfairTable ? (
                <PlayfairTable
                  table={view.data.playfairTable}
                  onLetterClick={(letter) => {
                    setInputValue((prev) => prev + letter);
                  }}
                />
              ) : null}

              {view.data.cipherType === "VIGENERE" &&
              view.data.vigenereDigits ? (
                <VigenereView
                  encryptedWord={view.data.encryptedWord}
                  vigenereDigits={view.data.vigenereDigits}
                  cipherKey={view.data.cipherKey}
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
