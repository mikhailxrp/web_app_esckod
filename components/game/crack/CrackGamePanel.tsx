'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { AttemptHistory } from '@/components/game/crack/AttemptHistory';
import { CrackCipherText } from '@/components/game/crack/CrackCipherText';
import { CrackCompletedView } from '@/components/game/crack/CrackCompletedView';
import { CrackHintButton } from '@/components/game/crack/CrackHintButton';
import { CrackSkipButton } from '@/components/game/crack/CrackSkipButton';
import { CrackWordInput } from '@/components/game/crack/CrackWordInput';
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
  | { phase: 'completed'; data: CompletedState };

interface CrackGamePanelProps {
  slotKey: string;
  onClose: () => void;
}

export function CrackGamePanel({ slotKey, onClose }: CrackGamePanelProps): ReactElement {
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
      console.error('[CrackGamePanel.loadState]', error);
      setView({ phase: 'error', message: 'Ошибка соединения.' });
    }
  }, [slotKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadState();
  }, [loadState]);

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
        console.error('[CrackGamePanel.completeMission]', error);
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
          toast.warning('Доступ заблокирован: попытки исчерпаны. Поле перегенерировано.');
          setView({
            phase: 'playing',
            data: {
              ...playing,
              wordList: result.newWordList ?? playing.wordList,
              attempts: [],
              attemptsUsed: 0,
              version: result.version,
              canSkip: result.canSkip ?? playing.canSkip,
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
        console.error('[CrackGamePanel.handleSelectWord]', error);
        toast.error('Ошибка соединения.');
      } finally {
        setBusy(false);
      }
    },
    [busy, view, slotKey, loadState, completeMission, refreshLogs],
  );

  const handleSkip = useCallback(async (): Promise<boolean> => {
    if (view.phase !== 'playing') return false;

    const playing = view.data;

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
      console.error('[CrackGamePanel.handleSkip]', error);
      toast.error('Ошибка соединения.');
      return false;
    }
  }, [view, slotKey, refreshLogs, refreshChat]);

  const hintText =
    view.phase === 'playing' || view.phase === 'completed' ? view.data.hintText : null;

  return (
    <article
      className="relative flex min-h-[480px] flex-col overflow-hidden rounded-game-lg border border-border bg-bg-primary shadow-game-card"
      aria-label="Взломщик"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <Image
          src="/assets/img/icon/cracker-icon.svg"
          alt=""
          width={20}
          height={20}
          aria-hidden="true"
        />
        <span className="font-mono text-game-sm uppercase tracking-game-wide text-accent">
          Взломщик
        </span>

        <div className="min-w-0 flex-1 overflow-hidden">
          <span
            className="block overflow-hidden whitespace-nowrap font-mono text-game-xs text-border tracking-[-0.05em]"
            aria-hidden="true"
          >
            {'////////////////////////////////////////////////////////////////////'}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть игровое поле"
          className="flex size-7 items-center justify-center rounded-game-sm border border-border font-mono text-game-xs text-content-secondary transition-colors hover:border-border-strong hover:text-content-primary"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1">
        {view.phase === 'loading' && (
          <div className="flex flex-1 items-center justify-center px-6 py-8">
            <p className="font-mono text-game-sm text-content-muted" role="status">
              Загрузка…
            </p>
          </div>
        )}

        {view.phase === 'error' && (
          <div className="flex flex-1 items-center justify-center px-6 py-8">
            <p className="font-mono text-game-sm text-semantic-error" role="alert">
              {view.message}
            </p>
          </div>
        )}

        {view.phase === 'completed' && (
          <div className="flex flex-1 items-center justify-center px-6 py-8">
            <CrackCompletedView
              resultPassword={view.data.resultPassword}
              targetUrl={view.data.targetUrl}
              targetEmail={view.data.targetEmail}
            />
          </div>
        )}

        {view.phase === 'playing' && (
          <>
            {/* Left column: input + attempt history */}
            <div className="flex w-[240px] shrink-0 flex-col gap-5 border-r border-border px-5 py-5">
              <CrackWordInput onSelect={handleSelectWord} disabled={busy} />

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

            {/* Right column: cipher text */}
            <div className="flex flex-1 p-5">
              <CrackCipherText words={view.data.wordList} />
            </div>
          </>
        )}
      </div>

      {/* Info button — bottom-right corner */}
      {hintText ? (
        <div className="absolute bottom-3 right-3">
          <CrackHintButton hintText={hintText} />
        </div>
      ) : null}
    </article>
  );
}
