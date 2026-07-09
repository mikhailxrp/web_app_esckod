'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { PipeTimer } from '@/components/game/rdp/PipeTimer';
import { PipeTile } from '@/components/game/rdp/PipeTile';
import type { PipeEndpoint } from '@/components/game/rdp/PipeTile';
import { RdpAccessDeniedOverlay } from '@/components/game/rdp/RdpAccessDeniedOverlay';
import { toast } from '@/components/ui/Toast';
import { computePuzzleProgress, isLocallySolved } from '@/lib/rdp/connectivity';
import type { PuzzleField, TileRotation } from '@/lib/rdp/types';
import { fetchWithVersion } from '@/lib/api/fetchWithVersion';
import { useLogStore } from '@/store/logStore';
import { ONBOARDING_TARGETS } from '@/constants/onboardingSteps';
import type {
  RdpCheckPuzzleResult,
  RdpRotateResult,
  RdpScenario,
  RdpTimerExpiredResult,
} from '@/types/rdp';

interface TimerData {
  timerStartedAt: string;
  timerSeconds: number;
}

interface PipesPuzzleProps {
  slotKey: string;
  rdpScenario: RdpScenario;
  initialField: PuzzleField;
  initialVersion: number;
  initialTimerData?: TimerData;
  initialCanSkip: boolean;
  onSolved: () => Promise<void>;
  onSkip: () => Promise<boolean>;
  onLoadState: () => Promise<void>;
  /** Режим демонстрации в онбординге — без API */
  demo?: boolean;
}

export function PipesPuzzle({
  slotKey,
  rdpScenario,
  initialField,
  initialVersion,
  initialTimerData,
  initialCanSkip,
  onSolved,
  onSkip,
  onLoadState,
  demo = false,
}: PipesPuzzleProps): ReactElement {
  const [field, setField] = useState<PuzzleField>(initialField);
  const [version, setVersion] = useState(initialVersion);
  const [timerData, setTimerData] = useState<TimerData | undefined>(initialTimerData);
  const [canSkip, setCanSkip] = useState(initialCanSkip);
  const [busy, setBusy] = useState(false);
  const [showDeniedOverlay, setShowDeniedOverlay] = useState(false);
  const checkingRef = useRef(false);

  const refreshLogs = useLogStore((s) => s.refreshLogs);

  const handleRotate = useCallback(
    async (tileId: string): Promise<void> => {
      if (busy) return;

      const tile = field.tiles.find((t) => t.id === tileId);
      if (!tile || tile.isLocked) return;

      const newRotation = ((tile.rotation + 90) % 360) as TileRotation;
      const optimisticField: PuzzleField = {
        ...field,
        tiles: field.tiles.map((t) => (t.id === tileId ? { ...t, rotation: newRotation } : t)),
      };

      if (demo) {
        setField(optimisticField);
        return;
      }

      setBusy(true);
      setField(optimisticField);

      try {
        const res = await fetchWithVersion(`/api/missions/rdp/${slotKey}/rotate-tile`, {
          body: { tileId, expectedVersion: version },
          onConflict: onLoadState,
        });

        if (res.status === 409) return;

        if (!res.ok) {
          setField(field);
          toast.error('Не удалось повернуть плитку.');
          return;
        }

        const result = (await res.json()) as RdpRotateResult;
        setField(result.puzzleField);
        setVersion(result.version);

        if (isLocallySolved(result.puzzleField) && !checkingRef.current) {
          checkingRef.current = true;
          try {
            const checkRes = await fetchWithVersion(
              `/api/missions/rdp/${slotKey}/check-puzzle`,
              {
                body: { expectedVersion: result.version },
                onConflict: onLoadState,
              },
            );

            if (checkRes.status === 409) return;

            if (checkRes.ok) {
              const checkData = (await checkRes.json()) as RdpCheckPuzzleResult;
              if (checkData.isSolved) {
                await onSolved();
              } else {
                setVersion(checkData.version);
              }
            }
          } finally {
            checkingRef.current = false;
          }
        }
      } catch (error) {
        console.error('[PipesPuzzle.handleRotate]', error);
        setField(field);
        toast.error('Ошибка соединения.');
      } finally {
        setBusy(false);
      }
    },
    [busy, field, version, slotKey, onSolved, onLoadState, demo],
  );

  const handleTimerExpire = useCallback((): void => {
    setShowDeniedOverlay(true);
  }, []);

  const handleRestart = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await fetchWithVersion(`/api/missions/rdp/${slotKey}/timer-expired`, {
        body: { expectedVersion: version },
        onConflict: onLoadState,
      });

      if (res.status === 409) {
        setShowDeniedOverlay(false);
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === 'TIMER_NOT_EXPIRED') {
          // Таймер еще не истек — рефетч актуального состояния
          await onLoadState();
          setShowDeniedOverlay(false);
        } else {
          toast.error('Не удалось перегенерировать поле.');
        }
        return;
      }

      const result = (await res.json()) as RdpTimerExpiredResult;
      setField(result.newPuzzleField);
      setVersion(result.version);
      setTimerData({
        timerStartedAt: result.timerStartedAt,
        timerSeconds: result.timerSeconds,
      });
      setCanSkip(result.canSkip);
      setShowDeniedOverlay(false);
      await refreshLogs();
    } catch (error) {
      console.error('[PipesPuzzle.handleRestart]', error);
      toast.error('Ошибка соединения.');
    } finally {
      setBusy(false);
    }
  }, [slotKey, version, onLoadState, refreshLogs]);

  // Карта tileId → роль/линия для подсветки точек входа и выхода.
  // entries[i] ↔ exits[i] — пара одной линии (источник правды генератора).
  const endpointByTileId = useMemo<Map<string, PipeEndpoint>>(() => {
    const map = new Map<string, PipeEndpoint>();
    field.entries.forEach((pos, index) => {
      map.set(`r${pos.row}c${pos.col}`, { role: 'entry', pairIndex: index });
    });
    field.exits.forEach((pos, index) => {
      map.set(`r${pos.row}c${pos.col}`, { role: 'exit', pairIndex: index });
    });
    return map;
  }, [field.entries, field.exits]);

  const pairCount = field.entries.length;

  const progress = computePuzzleProgress(field);
  const progressPercent = Math.round(progress * 100);

  return (
    <div className="relative flex flex-col gap-4">
      {/* Таймер (только сц.2) */}
      {rdpScenario === 2 && timerData ? (
        <div className="flex items-center justify-end">
          <PipeTimer
            timerStartedAt={timerData.timerStartedAt}
            timerSeconds={timerData.timerSeconds}
            onExpire={handleTimerExpire}
          />
        </div>
      ) : null}

      {/* CSS Grid пазл — центрирован */}
      <div className="flex justify-center">
        <div
          className="grid gap-1"
          data-onboarding-id={ONBOARDING_TARGETS.RDP_PUZZLE}
          style={{
            gridTemplateColumns: `repeat(${field.gridSize}, 64px)`,
            gridTemplateRows: `repeat(${field.gridSize}, 64px)`,
          }}
          aria-label={`Пазл ${field.gridSize}×${field.gridSize}`}
        >
          {field.tiles.map((tile) => (
            <PipeTile
              key={tile.id}
              tile={tile}
              onRotate={() => {
                void handleRotate(tile.id);
              }}
              disabled={busy}
              endpoint={endpointByTileId.get(tile.id)}
              whiteMarker={pairCount === 1}
            />
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1.5" aria-label={`Связность: ${progressPercent}%`}>
        <div className="flex items-center justify-between font-mono text-[14px] text-content-muted">
          <span>Связность трубопровода</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-game-full border border-border/60 bg-bg-secondary">
          <div
            className="h-full rounded-game-full bg-accent transition-all duration-300 shadow-game-glow-sm"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Оверлей «Доступ запрещен» */}
      {showDeniedOverlay ? (
        <RdpAccessDeniedOverlay
          canSkip={canSkip}
          busy={busy}
          onRestart={() => {
            void handleRestart();
          }}
          onSkip={onSkip}
        />
      ) : null}
    </div>
  );
}
