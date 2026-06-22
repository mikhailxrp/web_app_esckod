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
import { FinalReportButton } from "@/components/game/report/FinalReportButton";
import { FinalReportView } from "@/components/game/report/FinalReportView";
import { OnboardingController } from "@/components/game/onboarding/OnboardingController";
import { useChatStore } from "@/store/chatStore";
import type { OnboardingScene } from "@/types/onboarding";
import type { RdpConnectResult } from "@/types/rdp";

const MISSION_ORDER: MissionType[] = ["CRACK", "DECIPHER", "RDP"];

/** Заглушка для RdpGamePanel в demo-режиме (никогда не попадает в реальный API) */
const DEMO_RDP_CONNECT_RESULT: RdpConnectResult = {
  slotKey: "__demo_rdp__",
  displayName: "DEMO",
  rdpScenario: 1,
  isCompleted: false,
  logSubjectName: "",
  hintText: null,
};

function renderDemoMissionsContent(demoScene: OnboardingScene): React.ReactNode {
  switch (demoScene) {
    case "crack-launch":
      return (
        <div className="rounded-game-lg border border-border p-4">
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
            <MissionCard missionType="CRACK" demo />
          </div>
        </div>
      );

    case "crack-game":
    case "crack-done":
      return (
        <CrackGamePanel
          slotKey="__demo_crack__"
          demo
          demoState={{ slotKey: "__demo_crack__" }}
          onClose={() => {}}
        />
      );

    case "decipher-launch":
      return (
        <div className="rounded-game-lg border border-border p-4">
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
            <MissionCard missionType="DECIPHER" demo />
          </div>
        </div>
      );

    case "decipher-game":
    case "decipher-done":
      return (
        <DecipherGamePanel
          slotKey="__demo_decipher__"
          demo
          demoState={{ slotKey: "__demo_decipher__" }}
          onClose={() => {}}
        />
      );

    case "rdp-launch":
      return (
        <div className="rounded-game-lg border border-border p-4">
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
            <MissionCard missionType="RDP" demo />
          </div>
        </div>
      );

    case "rdp-game":
      return (
        <RdpGamePanel
          connectResult={DEMO_RDP_CONNECT_RESULT}
          demo
          demoState={{ connectResult: "pending" }}
          onClose={() => {}}
        />
      );

    default:
      return null;
  }
}

interface DashboardClientProps {
  activeMissionTypes: MissionType[];
  playerLogin: string;
  onboardingDone: boolean;
}

export function DashboardClient({
  activeMissionTypes,
  playerLogin,
  onboardingDone,
}: DashboardClientProps): React.ReactElement {
  const refresh = useChatStore((s) => s.refresh);
  const marinaVisible = useChatStore((s) => s.marina.isVisible);
  const [activeCrackSlotKey, setActiveCrackSlotKey] = useState<string | null>(null);
  const [activeDecipherSlotKey, setActiveDecipherSlotKey] = useState<string | null>(null);
  const [activeRdpConnect, setActiveRdpConnect] = useState<RdpConnectResult | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportAlreadySubmitted, setReportAlreadySubmitted] = useState(false);
  const [demoScene, setDemoScene] = useState<OnboardingScene | null>(null);

  useEffect(() => {
    if (onboardingDone) {
      void refresh();
    }
  }, [refresh, onboardingDone]);

  const handleOnboardingComplete = (): void => {
    void refresh();
  };

  const visibleMissions = MISSION_ORDER.filter((type) =>
    activeMissionTypes.includes(type),
  );

  // Показываем demo-панель когда сцена активна (не 'base' и не 'chat-final')
  const showDemoPanel =
    !onboardingDone &&
    demoScene !== null &&
    demoScene !== "base" &&
    demoScene !== "chat-final";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-6 px-11 py-6">
      {/* Онбординг-тур — рендерится поверх через fixed positioning */}
      {!onboardingDone && (
        <OnboardingController
          playerLogin={playerLogin}
          onSceneChange={setDemoScene}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Top bar: status + hint + logout */}
      <div className="flex items-start justify-between gap-4">
        <div data-onboarding-id="status-bar">
          <StatusBar playerLogin={playerLogin} />
        </div>

        <div className="flex items-center gap-3">
          <div data-onboarding-id="hints-button">
            <DetectiveHintsButton />
          </div>
          <LogoutButton />
        </div>
      </div>

      {reportOpen ? (
        <FinalReportView
          alreadySubmitted={reportAlreadySubmitted}
          onClose={() => setReportOpen(false)}
        />
      ) : (
        /* Main grid: left column + right sidebar */
        <div className="flex flex-1 gap-6">
          {/* Left column: missions section + operation history */}
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {/* Missions section — shows game panel when a mission is active */}
            <section aria-label="Миссии" data-onboarding-id="mission-tiles">
              {showDemoPanel ? (
                renderDemoMissionsContent(demoScene)
              ) : activeCrackSlotKey ? (
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

            <div data-onboarding-id="operation-history">
              <OperationHistory />
            </div>
          </div>

          {/* Right sidebar: chat panels */}
          <aside
            className="flex w-[320px] flex-shrink-0 flex-col gap-3 2xl:w-[455px]"
            aria-label="Чат-панели"
          >
            <div data-onboarding-id="chat-detective">
              <ChatPanel chatType="DETECTIVE" />
            </div>
            {marinaVisible && (
              <>
                <ChatPanel chatType="MARINA" />
                <FinalReportButton
                  onOpen={(alreadySubmitted) => {
                    setReportAlreadySubmitted(alreadySubmitted);
                    setReportOpen(true);
                  }}
                />
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
