'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { PipesPuzzle } from '@/components/game/rdp/PipesPuzzle';
import { RdpCompletedView } from '@/components/game/rdp/RdpCompletedView';
import { RdpHintButton } from '@/components/game/rdp/RdpHintButton';
import { RdpSolvedPlaceholder } from '@/components/game/rdp/RdpSolvedPlaceholder';
import { toast } from '@/components/ui/Toast';
import type { PuzzleField } from '@/lib/rdp/types';
import { useChatStore } from '@/store/chatStore';
import { useLogStore } from '@/store/logStore';
import type { RdpConnectResult, RdpPuzzleState, RdpScenario } from '@/types/rdp';

// ─── Типы стадий ─────────────────────────────────────────────────────────────

interface PuzzleStageData {
  field: PuzzleField;
  version: number;
  timerStartedAt?: string;
  timerSeconds?: number;
  canSkip: boolean;
}

type Stage =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'puzzle'; data: PuzzleStageData }
  | { phase: 'solvedPlaceholder' }
  | { phase: 'completed' };

// ─── Props ───────────────────────────────────────────────────────────────────

interface RdpGamePanelProps {
  connectResult: RdpConnectResult;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RdpGamePanel({ connectResult, onClose }: RdpGamePanelProps): ReactElement {
  const { slotKey, displayName, rdpScenario, isCompleted, hintText } = connectResult;

  const [stage, setStage] = useState<Stage>(
    isCompleted ? { phase: 'completed' } : { phase: 'loading' },
  );

  const refreshLogs = useLogStore((s) => s.refreshLogs);
  const refreshChat = useChatStore((s) => s.refresh);

  const loadState = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`/api/missions/rdp/${slotKey}/puzzle-state`);

      if (!res.ok) {
        setStage({ phase: 'error', message: 'Не удалось загрузить состояние миссии.' });
        return;
      }

      const data = (await res.json()) as RdpPuzzleState;

      setStage({
        phase: 'puzzle',
        data: {
          field: data.puzzleField,
          version: data.version,
          timerStartedAt: data.timerStartedAt,
          timerSeconds: data.timerSeconds,
          canSkip: false,
        },
      });
    } catch (error) {
      console.error('[RdpGamePanel.loadState]', error);
      setStage({ phase: 'error', message: 'Ошибка соединения.' });
    }
  }, [slotKey]);

  useEffect(() => {
    if (!isCompleted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadState();
    }
  }, [isCompleted, loadState]);

  const handleSolved = useCallback(async (): Promise<void> => {
    setStage({ phase: 'solvedPlaceholder' });
    await refreshLogs();
  }, [refreshLogs]);

  const handleSkip = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/missions/rdp/${slotKey}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === 'CANNOT_SKIP') {
          toast.error('Пропуск пока недоступен.');
        } else if (data.error === 'SKIP_NOT_ALLOWED_SCENARIO_1') {
          toast.error('Этот сценарий не позволяет пропуск.');
        } else {
          toast.error('Не удалось пропустить миссию.');
        }
        return false;
      }

      setStage({ phase: 'completed' });
      await Promise.all([refreshLogs(), refreshChat()]);
      return true;
    } catch (error) {
      console.error('[RdpGamePanel.handleSkip]', error);
      toast.error('Ошибка соединения.');
      return false;
    }
  }, [slotKey, refreshLogs, refreshChat]);

  const activeHintText =
    stage.phase === 'puzzle' || stage.phase === 'loading' || stage.phase === 'error'
      ? hintText
      : null;

  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-game-lg border border-border bg-[rgba(255,255,255,0.08)] shadow-game-card"
      aria-label="Удалённый доступ"
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
        <span className="font-mono text-game-panel uppercase tracking-game-wide text-accent">
          Удалённый доступ
        </span>
        {displayName ? (
          <span className="font-mono text-game-xs text-content-muted">— {displayName}</span>
        ) : null}

        <div className="min-w-0 flex-1 overflow-hidden">
          <span
            className="block overflow-hidden whitespace-nowrap font-mono text-game-xs text-border tracking-[-0.05em]"
            aria-hidden="true"
          >
            {'////////////////////////////////////////////////////////////////////'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <RdpHintButton hintText={activeHintText} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть удалённый доступ"
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
      <div className="p-6">
        {stage.phase === 'loading' && (
          <div className="flex min-h-[300px] items-center justify-center">
            <p className="font-mono text-game-sm text-content-muted" role="status">
              Установка соединения…
            </p>
          </div>
        )}

        {stage.phase === 'error' && (
          <div className="flex min-h-[300px] items-center justify-center">
            <p className="font-mono text-game-sm text-semantic-error" role="alert">
              {stage.message}
            </p>
          </div>
        )}

        {stage.phase === 'puzzle' && (
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
          />
        )}

        {stage.phase === 'solvedPlaceholder' && (
          <RdpSolvedPlaceholder onClose={onClose} />
        )}

        {stage.phase === 'completed' && (
          <RdpCompletedView displayName={displayName} onClose={onClose} />
        )}
      </div>
    </article>
  );
}
