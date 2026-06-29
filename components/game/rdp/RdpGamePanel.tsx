"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";

import { PipesPuzzle } from "@/components/game/rdp/PipesPuzzle";
import { RdpCompletedView } from "@/components/game/rdp/RdpCompletedView";
import { RdpHintButton } from "@/components/game/rdp/RdpHintButton";
import { WindowsSimulation } from "@/components/game/rdp/WindowsSimulation";
import GameLoader from "@/components/ui/GameLoader";
import { toast } from "@/components/ui/Toast";
import type { PuzzleField } from "@/lib/rdp/types";
import { useChatStore } from "@/store/chatStore";
import { useLogStore } from "@/store/logStore";
import type {
  RdpConnectResult,
  RdpFilesResult,
  RdpPuzzleState,
  RdpScenario,
} from "@/types/rdp";
import type { RdpDemoState } from "@/types/onboarding";
import { ONBOARDING_TARGETS } from "@/constants/onboardingSteps";
import {
  DEMO_RDP_INSTRUCTION_HINT,
  DEMO_RDP_PUZZLE_FIELD,
} from "@/constants/rdpOnboardingDemo";

// ─── Типы стадий ─────────────────────────────────────────────────────────────

interface PuzzleStageData {
  field: PuzzleField;
  version: number;
  timerStartedAt?: string;
  timerSeconds?: number;
  canSkip: boolean;
}

type Stage =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "puzzle"; data: PuzzleStageData }
  | { phase: "files" }
  | { phase: "completed" };

// ─── Props ───────────────────────────────────────────────────────────────────

interface RdpGamePanelProps {
  connectResult: RdpConnectResult;
  onClose: () => void;
  /** Режим демонстрации в онбординге — не вызывает реальный API */
  demo?: boolean;
  demoState?: RdpDemoState;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RdpGamePanel({
  connectResult,
  onClose,
  demo = false,
  demoState,
}: RdpGamePanelProps): ReactElement {
  const { slotKey, displayName, rdpScenario, isCompleted, hintText } =
    connectResult;

  const [stage, setStage] = useState<Stage>(
    isCompleted ? { phase: "completed" } : { phase: "loading" },
  );
  const [unlockedCount, setUnlockedCount] = useState(0);

  const refreshLogs = useLogStore((s) => s.refreshLogs);
  const refreshChat = useChatStore((s) => s.refresh);

  // ─── files-first loadState ────────────────────────────────────────────────
  // 1. Try GET /files — 200 means puzzle is solved (files stage / completed)
  // 2. 400 PUZZLE_NOT_SOLVED → fallback to GET /puzzle-state (puzzle stage)

  const loadState = useCallback(async (): Promise<void> => {
    try {
      const filesRes = await fetch(`/api/missions/rdp/${slotKey}/files`);

      if (filesRes.ok) {
        const filesData = (await filesRes.json()) as RdpFilesResult;
        if (filesData.completed) {
          setStage({ phase: "completed" });
        } else {
          // triggerActivated && !completed OR normal browsing — WindowsSimulation handles both
          setStage({ phase: "files" });
        }
        return;
      }

      const errData = (await filesRes.json().catch(() => ({}))) as {
        error?: string;
      };

      if (filesRes.status === 400 && errData.error === "PUZZLE_NOT_SOLVED") {
        // Puzzle not yet solved — load puzzle state
        const puzzleRes = await fetch(
          `/api/missions/rdp/${slotKey}/puzzle-state`,
        );

        if (!puzzleRes.ok) {
          setStage({
            phase: "error",
            message: "Не удалось загрузить состояние миссии.",
          });
          return;
        }

        const data = (await puzzleRes.json()) as RdpPuzzleState;
        setStage({
          phase: "puzzle",
          data: {
            field: data.puzzleField,
            version: data.version,
            timerStartedAt: data.timerStartedAt,
            timerSeconds: data.timerSeconds,
            canSkip: false,
          },
        });
      } else {
        setStage({
          phase: "error",
          message: "Не удалось загрузить состояние миссии.",
        });
      }
    } catch (error) {
      console.error("[RdpGamePanel.loadState]", error);
      setStage({ phase: "error", message: "Ошибка соединения." });
    }
  }, [slotKey]);

  useEffect(() => {
    if (demo) return; // demo-режим: не обращаемся к API
    if (!isCompleted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadState();
    }
  }, [isCompleted, loadState, demo]);

  // Demo: инициализируем пазл из demoState (не обращаемся к API)
  useEffect(() => {
    if (!demo || demoState?.phase !== "puzzle") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStage({
      phase: "puzzle",
      data: {
        field: demoState.puzzleField ?? DEMO_RDP_PUZZLE_FIELD,
        version: 0,
        canSkip: false,
      },
    });
  }, [demo, demoState]);

  const handleSolved = useCallback(async (): Promise<void> => {
    setStage({ phase: "files" });
    await refreshLogs();
  }, [refreshLogs]);

  const handleSkip = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/missions/rdp/${slotKey}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "CANNOT_SKIP") {
          toast.error("Пропуск пока недоступен.");
        } else if (data.error === "SKIP_NOT_ALLOWED_SCENARIO_1") {
          toast.error("Этот сценарий не позволяет пропуск.");
        } else {
          toast.error("Не удалось пропустить миссию.");
        }
        return false;
      }

      // Пазл пропущен — открываем симуляцию Windows, чтобы игрок мог
      // ознакомиться с документами перед активацией чата Марины.
      setStage({ phase: "files" });
      await refreshLogs();
      return true;
    } catch (error) {
      console.error("[RdpGamePanel.handleSkip]", error);
      toast.error("Ошибка соединения.");
      return false;
    }
  }, [slotKey, refreshLogs]);

  const handleCompleted = useCallback(async (): Promise<void> => {
    setStage({ phase: "completed" });
    await Promise.all([refreshLogs(), refreshChat()]);
  }, [refreshLogs, refreshChat]);

  const activeHintText =
    demo && demoState?.phase === "puzzle"
      ? DEMO_RDP_INSTRUCTION_HINT
      : stage.phase === "puzzle" ||
          stage.phase === "loading" ||
          stage.phase === "error"
        ? hintText
        : null;

  // Close (X) is hidden during files stage for scenario 1 until first folder is unlocked
  const showCloseButton =
    stage.phase !== "files" || rdpScenario !== 1 || unlockedCount > 0;

  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-game-lg border border-white bg-[rgba(255,255,255,0.08)] shadow-game-card"
      aria-label="Удаленный доступ"
      data-onboarding-id={ONBOARDING_TARGETS.RDP_MISSION_CARD}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <Image
          src="/assets/img/icon/remote-access-icon.svg"
          alt=""
          width={30}
          height={30}
          aria-hidden="true"
        />
        <span className="font-mono text-game-panel text-accent">
          Удаленный доступ
        </span>
        {displayName ? (
          <span className="font-mono text-[14px] text-content-muted">
            {" "}
            {displayName}
          </span>
        ) : null}

        <div className="min-w-0 flex-1 overflow-hidden">
          <span
            className="ml-auto pr-2 flex h-7 w-[calc(50%+70px)] items-center overflow-hidden whitespace-nowrap font-mono text-xl font-normal leading-none tracking-[-0.3em] text-white/30 select-none [direction:rtl]"
            aria-hidden="true"
          >
            {"/ ".repeat(14)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <RdpHintButton hintText={activeHintText} disabled={demo} />

          {/* Minimize button — available during files stage; progress is preserved on server */}
          {stage.phase === "files" ? (
            <div className="relative group">
              <button
                type="button"
                onClick={onClose}
                aria-label="Свернуть — прогресс сохранен"
                className="flex size-7 items-center justify-center rounded-game-sm border border-border transition-colors hover:border-accent"
              >
                <svg
                  width="12"
                  height="2"
                  viewBox="0 0 12 2"
                  aria-hidden="true"
                  className="text-content-secondary group-hover:text-accent transition-colors"
                >
                  <path
                    d="M0 1h12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <span
                className="pointer-events-none absolute right-0 top-full mt-1.5 whitespace-nowrap rounded-game-sm border border-border bg-bg-secondary px-2 py-1 font-mono text-game-xs text-content-secondary opacity-0 group-hover:opacity-100 transition-opacity z-50"
                role="tooltip"
              >
                Свернуть — прогресс сохранен
              </span>
            </div>
          ) : null}

          {/* Close (X) — hidden during files stage for scenario 1 until first folder unlocked */}
          {showCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть удаленный доступ"
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
          ) : null}
        </div>
      </div>

      {/* Body — no inner padding for files stage (desktop fills the area) */}
      <div className={stage.phase === "files" ? "" : "p-6"}>
        {demo && demoState?.phase === "launch" ? (
          <div className="flex min-h-[360px] flex-1 items-center justify-center px-6 py-8">
            <div className="mx-auto flex w-full max-w-[420px] flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="font-mono text-game-base text-content-secondary">
                  IP адрес
                </span>
                <input
                  readOnly
                  value=""
                  aria-label="IP адрес"
                  data-onboarding-id={ONBOARDING_TARGETS.RDP_FORM}
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
        ) : null}

        {stage.phase === "loading" &&
        !(
          demo &&
          (demoState?.phase === "launch" || demoState?.phase === "puzzle")
        ) ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <GameLoader />
          </div>
        ) : null}

        {stage.phase === "error" ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <p
              className="font-mono text-game-sm text-semantic-error"
              role="alert"
            >
              {stage.message}
            </p>
          </div>
        ) : null}

        {stage.phase === "puzzle" ? (
          <PipesPuzzle
            slotKey={slotKey}
            rdpScenario={rdpScenario as RdpScenario}
            initialField={stage.data.field}
            initialVersion={stage.data.version}
            initialTimerData={
              stage.data.timerStartedAt && stage.data.timerSeconds
                ? {
                    timerStartedAt: stage.data.timerStartedAt,
                    timerSeconds: stage.data.timerSeconds,
                  }
                : undefined
            }
            initialCanSkip={stage.data.canSkip}
            onSolved={handleSolved}
            onSkip={handleSkip}
            onLoadState={loadState}
            demo={demo}
          />
        ) : null}

        {stage.phase === "files" ? (
          <WindowsSimulation
            slotKey={slotKey}
            rdpScenario={rdpScenario as RdpScenario}
            onCompleted={() => void handleCompleted()}
            onUnlockedCountChange={setUnlockedCount}
          />
        ) : null}

        {stage.phase === "completed" ? (
          <RdpCompletedView displayName={displayName} onClose={onClose} />
        ) : null}
      </div>
    </article>
  );
}
