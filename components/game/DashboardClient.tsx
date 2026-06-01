"use client";

import Image from "next/image";
import type { MissionType } from "@prisma/client";
import { StatusBar } from "@/components/game/StatusBar";
import { MissionCard } from "@/components/game/MissionCard";
import { OperationHistory } from "@/components/game/operation-log/OperationHistory";
import { GAME_TARGET_NAME } from "@/constants/gameConfig";

const MISSION_ORDER: MissionType[] = ["CRACK", "DECIPHER", "RDP"];

interface DashboardClientProps {
  activeMissionTypes: MissionType[];
}

// ─── Chat panel placeholder ───────────────────────────────────────────────────

interface ChatPanelProps {
  label: string;
}

function ChatPanel({ label }: ChatPanelProps): React.ReactElement {
  return (
    <div className="flex items-center gap-2 rounded-game-md border border-border bg-bg-secondary px-3 py-2.5">
      <Image
        src="/assets/img/icon/chat-icon-message.svg"
        alt=""
        width={24}
        height={24}
        aria-hidden="true"
      />

      <span className="font-mono text-game-sm uppercase tracking-game-wide text-content-primary">
        {label}
      </span>

      <div className="min-w-0 flex-1 overflow-hidden">
        <span
          className="block overflow-hidden whitespace-nowrap font-mono text-game-xs text-border tracking-[-0.05em]"
          aria-hidden="true"
        >
          {
            "////////////////////////////////////////////////////////////////////"
          }
        </span>
      </div>

      <Image
        src="/assets/img/icon/close-chat-icon.svg"
        alt={`Открыть чат ${label}`}
        width={24}
        height={24}
      />
    </div>
  );
}

// ─── DashboardClient ──────────────────────────────────────────────────────────

export function DashboardClient({
  activeMissionTypes,
}: DashboardClientProps): React.ReactElement {
  const visibleMissions = MISSION_ORDER.filter((type) =>
    activeMissionTypes.includes(type),
  );

  return (
    <div className="flex min-h-screen flex-col gap-6 px-11 py-6">
      {/* Top bar: status + hint */}
      <div className="flex items-start justify-between gap-4">
        <StatusBar targetName={GAME_TARGET_NAME} />

        {/* Подсказка — Phase 9 placeholder */}
        <button
          type="button"
          disabled
          aria-label="Подсказка (недоступно)"
          className="rounded-game-md border border-border px-6 py-2.5 font-mono text-game-sm uppercase tracking-game-wide text-content-primary opacity-70 cursor-not-allowed"
        >
          Подсказка
        </button>
      </div>

      {/* Main grid: left column + right sidebar */}
      <div className="flex flex-1 gap-6">
        {/* Left column: mission cards section + operation history */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Mission cards section */}
          <section
            className="rounded-game-lg border border-border p-4"
            aria-label="Миссии"
          >
            {visibleMissions.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
                {visibleMissions.map((type) => (
                  <MissionCard key={type} missionType={type} />
                ))}
              </div>
            ) : (
              <div className="py-10 text-center" role="status">
                <p className="font-mono text-game-sm text-content-muted">
                  Нет активных миссий
                </p>
              </div>
            )}
          </section>

          <OperationHistory />
        </div>

        {/* Right sidebar: chat panels */}
        <aside
          className="flex w-[320px] flex-shrink-0 flex-col gap-3 2xl:w-[455px]"
          aria-label="Чат-панели"
        >
          <ChatPanel label="Детектив" />
          <ChatPanel label="Аноним" />
        </aside>
      </div>
    </div>
  );
}
