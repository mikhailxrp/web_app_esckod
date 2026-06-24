'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import type { ReactElement } from 'react';

import { AttemptHistory } from '@/components/game/crack/AttemptHistory';
import { CrackCompletedView } from '@/components/game/crack/CrackCompletedView';
import { CrackHintButton } from '@/components/game/crack/CrackHintButton';
import { CrackSkipButton } from '@/components/game/crack/CrackSkipButton';
import { WordGrid } from '@/components/game/crack/WordGrid';
import GameLoader from '@/components/ui/GameLoader';
import { toast } from '@/components/ui/Toast';
import { fetchWithVersion } from '@/lib/api/fetchWithVersion';
import { useChatStore } from '@/store/chatStore';
import { useLogStore } from '@/store/logStore';
import type {
  AttemptEntry,
  CrackAttemptResult,
  CrackCompleteResult,
  CrackState,
} from '@/types/crack';

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
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'playing'; data: PlayingState }
  | { phase: 'failed'; data: FailedState }
  | { phase: 'completed'; data: CompletedState };

interface CrackModalProps {
  slotKey: string;
  onClose: () => void;
}

export function CrackModal({ slotKey, onClose }: CrackModalProps): ReactElement {
  const [view, setView] = useState<View>({ phase: 'loading' });
  const [busy, setBusy] = useState(false);

  const refreshLogs = useLogStore((s) => s.refreshLogs);
  const refreshChat = useChatStore((s) => s.refresh);

  const loadState = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`/api/missions/crack/${slotKey}`);

      if (!res.ok) {
        setView({ phase: 'error', message: 'Не удалось загрузить миссию.' });
        return;
      }

      const data = (await res.json()) as CrackState;

      if (data.isCompleted) {
        setView({
          phase: 'completed',
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
        phase: 'playing',
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
      console.error('[CrackModal.loadState]', error);
      setView({ phase: 'error', message: 'Ошибка соединения.' });
    }
  }, [slotKey]);

  useEffect(() => {
    // Async-загрузка при монтировании — setState внутри loadState вызывается после await, не синхронно.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadState();
  }, [loadState]);

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

  const completeMission = useCallback(
    async (playing: PlayingState): Promise<void> => {
      try {
        const res = await fetch(`/api/missions/crack/${slotKey}/complete`, {
          method: 'POST',
        });

        if (!res.ok) {
          toast.error('Не удалось завершить миссию. Обновляю состояние.');
          await loadState();
          return;
        }

        const data = (await res.json()) as CrackCompleteResult;

        setView({
          phase: 'completed',
          data: {
            resultPassword: data.resultPassword,
            targetUrl: data.targetUrl,
            targetEmail: data.targetEmail,
            hintText: playing.hintText,
          },
        });

        await Promise.all([refreshLogs(), refreshChat()]);
      } catch (error) {
        console.error('[CrackModal.completeMission]', error);
        toast.error('Ошибка соединения.');
        await loadState();
      }
    },
    [slotKey, loadState, refreshLogs, refreshChat],
  );

  const handleSelectWord = useCallback(
    async (word: string): Promise<void> => {
      if (busy || view.phase !== 'playing') return;

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

        // 409 — loadState уже вызван в onConflict, состояние перечитано.
        if (res.status === 409) {
          return;
        }

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(
            data.error === 'WORD_NOT_IN_FIELD'
              ? 'Это слово не из текущего поля.'
              : 'Не удалось сделать попытку.',
          );
          return;
        }

        const result = (await res.json()) as CrackAttemptResult;

        if (result.isCorrect) {
          await completeMission(playing);
          return;
        }

        if (result.isFailed) {
          setView({
            phase: 'failed',
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
          phase: 'playing',
          data: {
            ...playing,
            attempts: [...playing.attempts, { word, positions: result.positions }],
            attemptsUsed: result.attemptsUsed,
            version: result.version,
          },
        });
      } catch (error) {
        console.error('[CrackModal.handleSelectWord]', error);
        toast.error('Ошибка соединения.');
      } finally {
        setBusy(false);
      }
    },
    [busy, view, slotKey, loadState, completeMission, refreshLogs],
  );

  const handleRestart = useCallback((): void => {
    if (view.phase !== 'failed') return;
    const { data } = view;
    setView({
      phase: 'playing',
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
      view.phase === 'playing' ? view.data
      : view.phase === 'failed' ? view.data.prevPlaying
      : null;

    if (!playing) return false;

    try {
      const res = await fetch(`/api/missions/crack/${slotKey}/skip`, {
        method: 'POST',
      });

      if (!res.ok) {
        toast.error('Не удалось пропустить миссию.');
        return false;
      }

      const data = (await res.json()) as CrackCompleteResult;

      setView({
        phase: 'completed',
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
      console.error('[CrackModal.handleSkip]', error);
      toast.error('Ошибка соединения.');
      return false;
    }
  }, [view, slotKey, refreshLogs, refreshChat]);

  const hintText =
    view.phase === 'playing' ? view.data.hintText
    : view.phase === 'failed' ? view.data.prevPlaying.hintText
    : view.phase === 'completed' ? view.data.hintText
    : null;

  return (
    <div
      className="fixed inset-0 z-card flex animate-modal-backdrop items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Взлом сайта"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[840px] animate-modal-panel flex-col overflow-hidden rounded-game-lg border border-white bg-bg-primary shadow-game-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <span className="font-mono text-game-sm uppercase tracking-game-wide text-accent">
            Взлом сайта
          </span>
          <div className="flex items-center gap-2">
            <CrackHintButton hintText={hintText} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть миссию"
              className="flex size-7 items-center justify-center rounded-game-sm border border-border transition-colors hover:border-accent"
            >
              <Image src="/assets/icons/close.svg" alt="" width={16} height={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {view.phase === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <GameLoader />
            </div>
          )}

          {view.phase === 'error' && (
            <p className="font-mono text-game-sm text-semantic-error" role="alert">
              {view.message}
            </p>
          )}

          {view.phase === 'completed' && (
            <CrackCompletedView
              resultPassword={view.data.resultPassword}
              targetUrl={view.data.targetUrl}
              targetEmail={view.data.targetEmail}
            />
          )}

          {view.phase === 'failed' && (
            <div className="flex min-h-[200px] items-center justify-center">
              <div
                className="flex w-[220px] flex-col gap-3 rounded-game-sm border border-border bg-bg-card p-4"
                role="alert"
                aria-live="assertive"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-game-sm text-content-primary">
                    Миссия провалена.
                  </span>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Закрыть миссию"
                    className="flex size-6 shrink-0 items-center justify-center rounded-game-sm border border-border transition-colors hover:border-accent"
                  >
                    <Image src="/assets/icons/close.svg" alt="" width={14} height={14} aria-hidden="true" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleRestart}
                  className="h-input-height w-full rounded-game-full bg-accent font-mono text-game-sm uppercase tracking-game-wide text-content-inverse transition-opacity hover:opacity-90"
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

          {view.phase === 'playing' && (
            <div className="flex flex-col gap-5">
              {(view.data.targetUrl || view.data.targetEmail) && (
                <div className="flex flex-col gap-1 font-mono text-game-xs text-content-muted">
                  {view.data.targetUrl && <span>Цель: {view.data.targetUrl}</span>}
                  {view.data.targetEmail && <span>Логин: {view.data.targetEmail}</span>}
                </div>
              )}

              <p
                className="font-mono text-game-sm text-content-secondary"
                aria-live="polite"
              >
                Попытка {view.data.attemptsUsed + 1} из {view.data.maxAttempts}
              </p>

              <WordGrid
                words={view.data.wordList}
                disabled={busy}
                onSelect={handleSelectWord}
              />

              <div className="border-t border-border pt-4">
                <AttemptHistory
                  attempts={view.data.attempts}
                  attemptsUsed={view.data.attemptsUsed}
                  maxAttempts={view.data.maxAttempts}
                />
              </div>

              {view.data.canSkip ? (
                <div className="flex justify-center border-t border-border pt-4">
                  <CrackSkipButton onSkip={handleSkip} disabled={busy} />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
