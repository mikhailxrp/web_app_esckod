"use client";

import { useEffect, useState } from "react";
import type { MissionType } from "@prisma/client";
import { StatusBar } from "@/components/game/StatusBar";
import { MissionCard } from "@/components/game/MissionCard";
import { OperationHistory } from "@/components/game/operation-log/OperationHistory";
import { ChatPanel } from "@/components/game/chat/ChatPanel";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { DetectiveHintsButton } from "@/components/game/hints/DetectiveHintsButton";
import { CrackGamePanel } from "@/components/game/crack/CrackGamePanel";
import { DecipherGamePanel } from "@/components/game/decipher/DecipherGamePanel";
import { RdpGamePanel } from "@/components/game/rdp/RdpGamePanel";
import { useChatStore } from "@/store/chatStore";
import type { RdpConnectResult } from "@/types/rdp";

const MISSION_ORDER: MissionType[] = ["CRACK", "DECIPHER", "RDP"];

interface DashboardClientProps {
  activeMissionTypes: MissionType[];
  playerLogin: string;
}

export function DashboardClient({
  activeMissionTypes,
  playerLogin,
}: DashboardClientProps): React.ReactElement {
  const refresh = useChatStore((s) => s.refresh);
  const marinaVisible = useChatStore((s) => s.marina.isVisible);
  const [activeCrackSlotKey, setActiveCrackSlotKey] = useState<string | null>(null);
  const [activeDecipherSlotKey, setActiveDecipherSlotKey] = useState<string | null>(null);
  const [activeRdpConnect, setActiveRdpConnect] = useState<RdpConnectResult | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleMissions = MISSION_ORDER.filter((type) =>
    activeMissionTypes.includes(type),
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-6 px-11 py-6">
      {/* Top bar: status + hint + logout */}
      <div className="flex items-start justify-between gap-4">
        <StatusBar playerLogin={playerLogin} />

        <div className="flex items-center gap-3">
          <DetectiveHintsButton />
          <LogoutButton />
        </div>
      </div>

      {/* Main grid: left column + right sidebar */}
      <div className="flex flex-1 gap-6">
        {/* Left column: missions section + operation history */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Missions section — shows game panel when a mission is active */}
          <section aria-label="Миссии">
            {activeCrackSlotKey ? (
              <CrackGamePanel
                slotKey={activeCrackSlotKey}
                onClose={() => setActiveCrackSlotKey(null)}
              />
            ) : activeDecipherSlotKey ? (
              <DecipherGamePanel
                slotKey={activeDecipherSlotKey}
                onClose={() => setActiveDecipherSlotKey(null)}
              />
            ) : activeRdpConnect ? (
              <RdpGamePanel
                connectResult={activeRdpConnect}
                onClose={() => setActiveRdpConnect(null)}
              />
            ) : (
              <div className="rounded-game-lg border border-border p-4">
                {visibleMissions.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
                    {visibleMissions.map((type) => (
                      <MissionCard
                        key={type}
                        missionType={type}
                        onCrackLaunched={setActiveCrackSlotKey}
                        onDecipherLaunched={setActiveDecipherSlotKey}
                        onRdpLaunched={setActiveRdpConnect}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center" role="status">
                    <p className="font-mono text-game-sm text-content-muted">
                      Нет активных миссий
                    </p>
                  </div>
                )}
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
          <ChatPanel chatType="DETECTIVE" />
          {marinaVisible && <ChatPanel chatType="MARINA" />}
        </aside>
      </div>

    </div>
  );
}
