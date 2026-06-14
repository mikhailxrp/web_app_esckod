'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { PipesPuzzle } from '@/components/game/rdp/PipesPuzzle';
import { RdpCompletedView } from '@/components/game/rdp/RdpCompletedView';
import { RdpHintButton } from '@/components/game/rdp/RdpHintButton';
import { WindowsSimulation } from '@/components/game/rdp/WindowsSimulation';
import { toast } from '@/components/ui/Toast';
import type { PuzzleField } from '@/lib/rdp/types';
import { useChatStore } from '@/store/chatStore';
import { useLogStore } from '@/store/logStore';
import type {
  RdpConnectResult,
  RdpFilesResult,
  RdpPuzzleState,
  RdpScenario,
} from '@/types/rdp';

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
  | { phase: 'files' }
  | { phase: 'completed' };

// ─── Props ───────────────────────────────────────────────────────────────────

interface RdpModalProps {
  connectResult: RdpConnectResult;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RdpModal({ connectResult, onClose }: RdpModalProps): ReactElement {
  const { slotKey, displayName, rdpScenario, isCompleted, hintText } = connectResult;

  const [stage, setStage] = useState<Stage>(
    isCompleted ? { phase: 'completed' } : { phase: 'loading' },
  );

  const refreshLogs = useLogStore((s) => s.refreshLogs);
  const refreshChat = useChatStore((s) => s.refresh);

  const loadState = useCallback(async (): Promise<void> => {
    try {
      const filesRes = await fetch(`/api/missions/rdp/${slotKey}/files`);

      if (filesRes.ok) {
        const filesData = (await filesRes.json()) as RdpFilesResult;
        if (filesData.completed) {
          setStage({ phase: 'completed' });
        } else {
          setStage({ phase: 'files' });
        }
        return;
      }

      const errData = (await filesRes.json().catch(() => ({}))) as { error?: string };

      if (filesRes.status === 400 && errData.error === 'PUZZLE_NOT_SOLVED') {
        const puzzleRes = await fetch(`/api/missions/rdp/${slotKey}/puzzle-state`);

        if (!puzzleRes.ok) {
          setStage({ phase: 'error', message: 'Не удалось загрузить состояние миссии.' });
          return;
        }

        const data = (await puzzleRes.json()) as RdpPuzzleState;
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
      } else {
        setStage({ phase: 'error', message: 'Не удалось загрузить состояние миссии.' });
      }
    } catch (error) {
      console.error('[RdpModal.loadState]', error);
      setStage({ phase: 'error', message: 'Ошибка соединения.' });
    }
  }, [slotKey]);

  useEffect(() => {
    if (!isCompleted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadState();
    }
  }, [isCompleted, loadState]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSolved = useCallback(async (): Promise<void> => {
    setStage({ phase: 'files' });
    await refreshLogs();
  }, [refreshLogs]);

  const handleCompleted = useCallback(async (): Promise<void> => {
    setStage({ phase: 'completed' });
    await Promise.all([refreshLogs(), refreshChat()]);
  }, [refreshLogs, refreshChat]);

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
      console.error('[RdpModal.handleSkip]', error);
      toast.error('Ошибка соединения.');
      return false;
    }
  }, [slotKey, refreshLogs, refreshChat]);

  const activeHintText =
    stage.phase === 'puzzle' || stage.phase === 'loading' || stage.phase === 'error'
      ? hintText
      : null;

  return (
    <div
      className="fixed inset-0 z-card flex animate-modal-backdrop items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Удалённый доступ"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[680px] animate-modal-panel flex-col overflow-hidden rounded-game-lg border border-border bg-bg-primary shadow-game-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
          <Image
            src="/assets/img/icon/remote-access-icon.svg"
            alt=""
            width={20}
            height={20}
            aria-hidden="true"
          />
          <span className="font-mono text-game-sm uppercase tracking-game-wide text-accent">
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
              aria-label="Закрыть окно удалённого доступа"
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
        <div className="flex-1 overflow-y-auto px-6 py-5">
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

          {stage.phase === 'files' && (
            <WindowsSimulation
              slotKey={slotKey}
              rdpScenario={rdpScenario as RdpScenario}
              onCompleted={() => void handleCompleted()}
              onUnlockedCountChange={() => undefined}
            />
          )}

          {stage.phase === 'completed' && (
            <RdpCompletedView displayName={displayName} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}
