'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { FolderContent } from '@/components/game/rdp/FolderContent';
import { FolderIcon } from '@/components/game/rdp/FolderIcon';
import { FolderPasswordPrompt } from '@/components/game/rdp/FolderPasswordPrompt';
import { PdfViewer } from '@/components/game/rdp/PdfViewer';
import { SessionLostModal } from '@/components/game/rdp/SessionLostModal';
import { SessionTerminatedModal } from '@/components/game/rdp/SessionTerminatedModal';
import { fetchWithVersion } from '@/lib/api/fetchWithVersion';
import { toast } from '@/components/ui/Toast';
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
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WindowsSimulation({
  slotKey,
  rdpScenario,
  onCompleted,
  onUnlockedCountChange,
}: WindowsSimulationProps): ReactElement {
  const [stage, setStage] = useState<SimStage>({ phase: 'loading' });
  const [folders, setFolders] = useState<RdpFolderView[]>([]);
  const [version, setVersion] = useState(0);
  const [nextIp, setNextIp] = useState<string | null>(null);
  const [windows, setWindows] = useState<WindowEntry[]>([]);
  const [windowOrder, setWindowOrder] = useState<WindowId[]>([]);
  const [passwordFolder, setPasswordFolder] = useState<RdpFolderView | null>(null);
  // Scenario 1: плашка «файлы скрыты» → клик → показать SessionLostModal
  const [showSessionLostModal, setShowSessionLostModal] = useState(false);

  // Track cascading position per window (stable across re-renders)
  const windowPositionCounter = useRef(0);
  const windowPositions = useRef<Map<WindowId, number>>(new Map());

  // Stable refs to avoid stale closures in callbacks
  const onCompletedRef = useRef(onCompleted);
  const onUnlockedCountChangeRef = useRef(onUnlockedCountChange);
  useEffect(() => {
    onCompletedRef.current = onCompleted;
  });
  useEffect(() => {
    onUnlockedCountChangeRef.current = onUnlockedCountChange;
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
            ? 'Миссия ещё не активирована.'
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
      windowPositions.current.set(id, windowPositionCounter.current++);
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

  const handleViewerClose = useCallback(
    (windowId: WindowId, result: RdpFileViewedResult): void => {
      closeWindow(windowId);
      setVersion(result.version);

      if (result.triggered && result.scenarioFinal) {
        const sf = result.scenarioFinal;
        if (result.nextIp) {
          setNextIp(result.nextIp);
        }
        setStage({ phase: 'triggered', scenarioFinal: sf });
      }
    },
    [closeWindow],
  );

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
      }}
      aria-label="Рабочий стол Windows"
    >
      {/* Loading state */}
      {stage.phase === 'loading' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <p className="font-mono text-game-sm text-white drop-shadow" role="status">
            Загрузка файлов…
          </p>
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
    </div>
  );
}
