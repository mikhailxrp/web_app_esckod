'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { FolderContent } from '@/components/game/rdp/FolderContent';
import { FolderIcon } from '@/components/game/rdp/FolderIcon';
import { FolderPasswordPrompt } from '@/components/game/rdp/FolderPasswordPrompt';
import { PdfViewer } from '@/components/game/rdp/PdfViewer';
import { RdpCloseWarningModal } from '@/components/game/rdp/RdpCloseWarningModal';
import { SessionLostModal } from '@/components/game/rdp/SessionLostModal';
import { SessionTerminatedModal } from '@/components/game/rdp/SessionTerminatedModal';
import { fetchWithVersion } from '@/lib/api/fetchWithVersion';
import GameLoader from '@/components/ui/GameLoader';
import { toast } from '@/components/ui/Toast';
import { useChatStore } from '@/store/chatStore';
import { useLogStore } from '@/store/logStore';
import type {
  RdpCompleteResult,
  RdpFileView,
  RdpFileViewedResult,
  RdpFilesResult,
  RdpFolderView,
  RdpScenario,
  RdpScenarioFinal,
} from '@/types/rdp';

// ─── Window manager types ─────────────────────────────────────────────────────

type WindowId = string;

interface ExplorerWindow {
  id: WindowId;
  type: 'explorer';
  folderName: string;
}

interface ViewerWindow {
  id: WindowId;
  type: 'viewer';
  file: RdpFileView;
}

type WindowEntry = ExplorerWindow | ViewerWindow;

// ─── Internal stage ───────────────────────────────────────────────────────────

type SimStage =
  | { phase: 'loading' }
  | { phase: 'browsing' }
  | { phase: 'triggered'; scenarioFinal: RdpScenarioFinal }
  | { phase: 'completing' }
  | { phase: 'error'; message: string };

// ─── Props ───────────────────────────────────────────────────────────────────

interface WindowsSimulationProps {
  slotKey: string;
  rdpScenario: RdpScenario;
  onCompleted: () => void;
  onUnlockedCountChange: (count: number) => void;
  /** Real close/minimize of the mission window (bubbled from RdpGamePanel). */
  onCloseMission: () => void;
}

export interface WindowsSimulationHandle {
  /** RdpGamePanel calls this instead of closing directly, so we get a chance
   *  to flush any still-open PDF viewers first (see requestClose below). */
  requestClose: (intent: 'minimize' | 'close') => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const WindowsSimulation = forwardRef<WindowsSimulationHandle, WindowsSimulationProps>(
  function WindowsSimulation(
    { slotKey, rdpScenario, onCompleted, onUnlockedCountChange, onCloseMission },
    ref,
  ): ReactElement {
  const showTriggeredMessage = useChatStore((s) => s.showTriggeredMessage);
  const refreshLogs = useLogStore((s) => s.refreshLogs);

  const [stage, setStage] = useState<SimStage>({ phase: 'loading' });
  const [folders, setFolders] = useState<RdpFolderView[]>([]);
  const [version, setVersion] = useState(0);
  const [nextIp, setNextIp] = useState<string | null>(null);
  const [windows, setWindows] = useState<WindowEntry[]>([]);
  const [windowOrder, setWindowOrder] = useState<WindowId[]>([]);
  const [passwordFolder, setPasswordFolder] = useState<RdpFolderView | null>(null);
  // Scenario 1: плашка «файлы скрыты» → клик → показать SessionLostModal
  const [showSessionLostModal, setShowSessionLostModal] = useState(false);
  // Игрок попытался свернуть/закрыть окно миссии, пока есть незакрытые PDF-окна
  const [closeWarning, setCloseWarning] = useState<{
    intent: 'minimize' | 'close';
    fileNames: string[];
  } | null>(null);
  const [isClosingWithFlush, setIsClosingWithFlush] = useState(false);

  // Track cascading position per window (stable across re-renders)
  const windowPositions = useRef<Map<WindowId, number>>(new Map());

  // Stable refs to avoid stale closures in callbacks
  const onCompletedRef = useRef(onCompleted);
  const onUnlockedCountChangeRef = useRef(onUnlockedCountChange);
  const onCloseMissionRef = useRef(onCloseMission);
  useEffect(() => {
    onCompletedRef.current = onCompleted;
  });
  useEffect(() => {
    onUnlockedCountChangeRef.current = onUnlockedCountChange;
  });
  useEffect(() => {
    onCloseMissionRef.current = onCloseMission;
  });

  const getScenarioFinal = useCallback((): RdpScenarioFinal => {
    return rdpScenario === 1 ? 'session_lost' : 'session_terminated';
  }, [rdpScenario]);

  // ─── Unlocked count helper ────────────────────────────────────────────────

  const reportUnlockedCount = useCallback((currentFolders: RdpFolderView[]): void => {
    const count = currentFolders.filter((f) => f.isUnlocked).length;
    onUnlockedCountChangeRef.current(count);
  }, []);

  // ─── Data fetching ───────────────────────────────────────────────────────

  const loadFiles = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`/api/missions/rdp/${slotKey}/files`);

      if (!res.ok) {
        setStage({ phase: 'error', message: 'Не удалось загрузить файлы.' });
        return;
      }

      const data = (await res.json()) as RdpFilesResult;
      setFolders(data.folders);
      setVersion(data.version);
      reportUnlockedCount(data.folders);

      if (data.triggerActivated) {
        const sf = getScenarioFinal();
        if (data.nextIp) {
          setNextIp(data.nextIp);
        }
        setStage({ phase: 'triggered', scenarioFinal: sf });
      } else {
        setStage({ phase: 'browsing' });
      }
    } catch (err) {
      console.error('[WindowsSimulation.loadFiles]', err);
      setStage({ phase: 'error', message: 'Ошибка соединения.' });
    }
  }, [slotKey, getScenarioFinal, reportUnlockedCount]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleConflict = useCallback(async (): Promise<void> => {
    await loadFiles();
  }, [loadFiles]);

  // ─── Complete mission ────────────────────────────────────────────────────

  const handleComplete = useCallback(async (): Promise<void> => {
    setStage({ phase: 'completing' });

    try {
      const res = await fetchWithVersion(`/api/missions/rdp/${slotKey}/complete`, {
        body: { expectedVersion: version },
        onConflict: async () => {
          await loadFiles();
        },
      });

      if (res.status === 409) {
        // onConflict already called loadFiles(); stage will be reset by loadFiles
        return;
      }

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        const msg =
          errData.error === 'TRIGGER_NOT_ACTIVATED'
            ? 'Миссия еще не активирована.'
            : 'Не удалось завершить миссию.';
        toast.error(msg);
        // Restore triggered stage so user can retry
        setStage({ phase: 'triggered', scenarioFinal: getScenarioFinal() });
        return;
      }

      const data = (await res.json()) as RdpCompleteResult;
      setVersion(data.version);
      onCompletedRef.current();
    } catch (err) {
      console.error('[WindowsSimulation.handleComplete]', err);
      toast.error('Ошибка соединения.');
      setStage({ phase: 'triggered', scenarioFinal: getScenarioFinal() });
    }
  }, [slotKey, version, loadFiles, getScenarioFinal]);

  // ─── Window manager ──────────────────────────────────────────────────────

  const getWindowPosition = useCallback((id: WindowId): number => {
    if (!windowPositions.current.has(id)) {
      windowPositions.current.set(id, windowPositions.current.size);
    }
    return windowPositions.current.get(id) ?? 0;
  }, []);

  const focusWindow = useCallback((id: WindowId): void => {
    setWindowOrder((prev) => [...prev.filter((w) => w !== id), id]);
  }, []);

  const closeWindow = useCallback((id: WindowId): void => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    setWindowOrder((prev) => prev.filter((w) => w !== id));
    windowPositions.current.delete(id);
  }, []);

  const openExplorer = useCallback((folderName: string): void => {
    const id = `explorer-${folderName}`;
    setWindows((prev) => {
      if (prev.find((w) => w.id === id)) return prev;
      return [...prev, { id, type: 'explorer', folderName }];
    });
    setWindowOrder((prev) => [...prev.filter((w) => w !== id), id]);
  }, []);

  const openViewer = useCallback((file: RdpFileView): void => {
    const id = `viewer-${file.id}`;
    setWindows((prev) => {
      if (prev.find((w) => w.id === id)) return prev;
      return [...prev, { id, type: 'viewer', file }];
    });
    setWindowOrder((prev) => [...prev.filter((w) => w !== id), id]);
  }, []);

  // ─── User interactions ───────────────────────────────────────────────────

  const handleFolderDoubleClick = useCallback(
    (folderName: string): void => {
      const folder = folders.find((f) => f.folderName === folderName);
      if (!folder) return;

      if (folder.isLocked && !folder.isUnlocked) {
        setPasswordFolder(folder);
      } else {
        openExplorer(folderName);
      }
    },
    [folders, openExplorer],
  );

  const handleUnlock = useCallback(
    (folderName: string, newVersion: number): void => {
      // Optimistic update: mark folder as unlocked so the explorer opens immediately.
      // Files still have url: null from the initial locked fetch, so we also call
      // loadFiles() to get the real file URLs for the now-unlocked folder.
      const updatedFolders = folders.map((f) =>
        f.folderName === folderName ? { ...f, isUnlocked: true } : f,
      );
      setFolders(updatedFolders);
      reportUnlockedCount(updatedFolders);
      setVersion(newVersion);
      setPasswordFolder(null);
      openExplorer(folderName);
      void loadFiles();
    },
    [folders, openExplorer, reportUnlockedCount, loadFiles],
  );

  // Общая обработка ответа /file-viewed — переиспользуется и одиночным
  // закрытием PDF-окна, и «пакетным» флашем при сворачивании/закрытии миссии.
  const applyFileViewedResult = useCallback(
    (windowId: WindowId, result: RdpFileViewedResult): void => {
      closeWindow(windowId);
      setVersion(result.version);

      if (result.chatAdvanced) {
        void showTriggeredMessage('DETECTIVE');
      }

      if (result.triggered && result.scenarioFinal) {
        const sf = result.scenarioFinal;
        if (result.nextIp) {
          setNextIp(result.nextIp);
        }
        setStage({ phase: 'triggered', scenarioFinal: sf });
        void refreshLogs();
      }
    },
    [closeWindow, showTriggeredMessage, refreshLogs],
  );

  const handleViewerClose = useCallback(
    (windowId: WindowId, result: RdpFileViewedResult): void => {
      applyFileViewedResult(windowId, result);
    },
    [applyFileViewedResult],
  );

  // Игрок открыл PDF, но так и не закрыл его собственным крестиком, а вместо
  // этого пытается свернуть/закрыть окно миссии целиком. Без этого шага
  // file-viewed для таких файлов никогда не ушёл бы на сервер — просмотр
  // «терялся» бы молча, и автоматический сюжетный триггер (потеря доступа /
  // чат Марины) не сработал бы, хотя игрок реально открывал и читал файл.
  // Репортим по очереди, последовательно продвигая expectedVersion.
  const flushOpenViewers = useCallback(async (): Promise<boolean> => {
    const viewerWindows = windows.filter(
      (w): w is ViewerWindow => w.type === 'viewer',
    );

    let currentVersion = version;
    let didTrigger = false;

    for (const w of viewerWindows) {
      try {
        const res = await fetchWithVersion(`/api/missions/rdp/${slotKey}/file-viewed`, {
          body: { fileId: w.file.id, expectedVersion: currentVersion },
          onConflict: async () => {
            await loadFiles();
          },
        });

        if (res.status === 409) {
          // onConflict уже перезагрузил актуальное состояние — локальный
          // список windows устарел, дальше по этой пачке не идём.
          return didTrigger;
        }

        if (!res.ok) {
          // Не блокируем закрытие из-за отдельного сбоя — просто оставляем
          // это окно как есть, не теряя его молча из вида.
          continue;
        }

        const result = (await res.json()) as RdpFileViewedResult;
        currentVersion = result.version;
        applyFileViewedResult(w.id, result);
        if (result.triggered && result.scenarioFinal) {
          didTrigger = true;
        }
      } catch (err) {
        console.error('[WindowsSimulation.flushOpenViewers]', err);
      }
    }

    return didTrigger;
  }, [windows, version, slotKey, loadFiles, applyFileViewedResult]);

  const requestClose = useCallback(
    (intent: 'minimize' | 'close'): void => {
      // Only intercept while actually browsing files. Once the story trigger
      // has already fired (or while loading/erroring), there is nothing
      // meaningful left to flush — any leftover `windows` entries are stale
      // and the SessionLost/SessionTerminated overlay may already be asking
      // for the player's attention, so don't stack another modal on top.
      if (stage.phase !== 'browsing') {
        onCloseMissionRef.current();
        return;
      }

      const openFileNames = windows
        .filter((w): w is ViewerWindow => w.type === 'viewer')
        .map((w) => w.file.name);

      if (openFileNames.length === 0) {
        onCloseMissionRef.current();
        return;
      }

      setCloseWarning({ intent, fileNames: openFileNames });
    },
    [stage.phase, windows],
  );

  useImperativeHandle(ref, () => ({ requestClose }), [requestClose]);

  const handleConfirmClose = useCallback(async (): Promise<void> => {
    setIsClosingWithFlush(true);
    const didTrigger = await flushOpenViewers();
    setIsClosingWithFlush(false);
    setCloseWarning(null);

    // Если флаш только что активировал сюжетный триггер — не закрываем окно
    // миссии молча, даём игроку увидеть тот же экран, что он увидел бы,
    // закрыв файл правильно (SessionLostModal / SessionTerminatedModal).
    if (!didTrigger) {
      onCloseMissionRef.current();
    }
  }, [flushOpenViewers]);

  // ─── Render ──────────────────────────────────────────────────────────────

  const isBrowsing = stage.phase === 'browsing';
  const isTriggered = stage.phase === 'triggered';
  const isCompleting = stage.phase === 'completing';
  const passwordZIndex = 10 + windowOrder.length + 20;

  const triggeredScenarioFinal =
    isTriggered ? (stage as { phase: 'triggered'; scenarioFinal: RdpScenarioFinal }).scenarioFinal : null;

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        minHeight: '500px',
        backgroundImage: "url('/assets/img/desctop_windows_bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        letterSpacing: 'normal',
        caretColor: 'auto',
      }}
      aria-label="Рабочий стол Windows"
    >
      {/* Loading state */}
      {stage.phase === 'loading' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <GameLoader />
        </div>
      ) : null}

      {/* Error state */}
      {stage.phase === 'error' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <p className="font-mono text-game-sm text-red-300 drop-shadow" role="alert">
            {stage.message}
          </p>
        </div>
      ) : null}

      {/* Triggered — scenario 2: SessionTerminatedModal immediately */}
      {isTriggered && triggeredScenarioFinal === 'session_terminated' ? (
        <SessionTerminatedModal
          onClose={() => void handleComplete()}
          isLoading={isCompleting}
        />
      ) : null}

      {/* Triggered — scenario 1: plashka + optional SessionLostModal */}
      {isTriggered && triggeredScenarioFinal === 'session_lost' ? (
        <>
          {/* «Files hidden» plashka — click opens the modal */}
          <button
            type="button"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 cursor-pointer"
            onClick={() => setShowSessionLostModal(true)}
            aria-label="Показать сообщение об ошибке сессии"
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="18" cy="18" r="17" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
              <path
                d="M10 10l16 16M26 10L10 26"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeOpacity="0.8"
              />
            </svg>
            <p className="font-mono text-game-sm text-white/80 drop-shadow select-none">
              Соединение разорвано. Нажмите для подробностей.
            </p>
          </button>

          {showSessionLostModal ? (
            <SessionLostModal
              nextIp={nextIp ?? '—'}
              onClose={() => void handleComplete()}
              isLoading={isCompleting}
            />
          ) : null}
        </>
      ) : null}

      {/* Completing overlay */}
      {isCompleting ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <p className="font-mono text-game-sm text-white drop-shadow" role="status">
            Завершение миссии…
          </p>
        </div>
      ) : null}

      {/* Folder icons on desktop (top-right) */}
      {isBrowsing ? (
        <div className="absolute top-3 right-4 flex gap-1">
          {folders.map((folder) => (
            <FolderIcon
              key={folder.folderName}
              folder={folder}
              onDoubleClick={handleFolderDoubleClick}
            />
          ))}
        </div>
      ) : null}

      {/* Open windows */}
      {isBrowsing
        ? windows.map((entry) => {
            const zIndex = 10 + (windowOrder.indexOf(entry.id) + 1);
            const positionOffset = getWindowPosition(entry.id);

            if (entry.type === 'explorer') {
              const folder = folders.find((f) => f.folderName === entry.folderName);
              if (!folder) return null;

              return (
                <FolderContent
                  key={entry.id}
                  folder={folder}
                  zIndex={zIndex}
                  positionOffset={positionOffset}
                  onClose={() => closeWindow(entry.id)}
                  onMinimize={() => closeWindow(entry.id)}
                  onFocus={() => focusWindow(entry.id)}
                  onFileOpen={openViewer}
                />
              );
            }

            if (entry.type === 'viewer') {
              return (
                <PdfViewer
                  key={entry.id}
                  file={entry.file}
                  slotKey={slotKey}
                  version={version}
                  zIndex={zIndex}
                  positionOffset={positionOffset}
                  onClose={(result) => handleViewerClose(entry.id, result)}
                  onFocus={() => focusWindow(entry.id)}
                  onConflict={handleConflict}
                />
              );
            }

            return null;
          })
        : null}

      {/* Password prompt (always above all windows) */}
      {isBrowsing && passwordFolder ? (
        <FolderPasswordPrompt
          folder={passwordFolder}
          version={version}
          slotKey={slotKey}
          zIndex={passwordZIndex}
          onUnlock={handleUnlock}
          onClose={() => setPasswordFolder(null)}
          onConflict={handleConflict}
        />
      ) : null}

      {/* Попытка свернуть/закрыть миссию с незакрытыми PDF-окнами */}
      {closeWarning ? (
        <RdpCloseWarningModal
          intent={closeWarning.intent}
          fileNames={closeWarning.fileNames}
          busy={isClosingWithFlush}
          onConfirm={() => void handleConfirmClose()}
          onCancel={() => setCloseWarning(null)}
        />
      ) : null}
    </div>
  );
  },
);

WindowsSimulation.displayName = 'WindowsSimulation';
