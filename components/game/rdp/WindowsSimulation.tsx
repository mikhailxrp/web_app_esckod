'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { FolderContent } from '@/components/game/rdp/FolderContent';
import { FolderIcon } from '@/components/game/rdp/FolderIcon';
import { FolderPasswordPrompt } from '@/components/game/rdp/FolderPasswordPrompt';
import { PdfViewer } from '@/components/game/rdp/PdfViewer';
import type {
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
  | { phase: 'error'; message: string };

// ─── Props ───────────────────────────────────────────────────────────────────

interface WindowsSimulationProps {
  slotKey: string;
  rdpScenario: RdpScenario;
  onTriggered: (scenarioFinal: RdpScenarioFinal, version: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WindowsSimulation({
  slotKey,
  rdpScenario,
  onTriggered,
}: WindowsSimulationProps): ReactElement {
  const [stage, setStage] = useState<SimStage>({ phase: 'loading' });
  const [folders, setFolders] = useState<RdpFolderView[]>([]);
  const [version, setVersion] = useState(0);
  const [windows, setWindows] = useState<WindowEntry[]>([]);
  const [windowOrder, setWindowOrder] = useState<WindowId[]>([]);
  const [passwordFolder, setPasswordFolder] = useState<RdpFolderView | null>(null);

  // Track cascading position per window (stable across re-renders)
  const windowPositionCounter = useRef(0);
  const windowPositions = useRef<Map<WindowId, number>>(new Map());

  // Stable ref for onTriggered callback to avoid stale closures
  const onTriggeredRef = useRef(onTriggered);
  useEffect(() => {
    onTriggeredRef.current = onTriggered;
  });

  const getScenarioFinal = useCallback((): RdpScenarioFinal => {
    return rdpScenario === 1 ? 'session_lost' : 'session_terminated';
  }, [rdpScenario]);

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

      if (data.triggerActivated) {
        const sf = getScenarioFinal();
        setStage({ phase: 'triggered', scenarioFinal: sf });
        onTriggeredRef.current(sf, data.version);
      } else {
        setStage({ phase: 'browsing' });
      }
    } catch (err) {
      console.error('[WindowsSimulation.loadFiles]', err);
      setStage({ phase: 'error', message: 'Ошибка соединения.' });
    }
  }, [slotKey, getScenarioFinal]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleConflict = useCallback(async (): Promise<void> => {
    await loadFiles();
  }, [loadFiles]);

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
      // Optimistic update: mark folder as unlocked immediately
      setFolders((prev) =>
        prev.map((f) => (f.folderName === folderName ? { ...f, isUnlocked: true } : f)),
      );
      setVersion(newVersion);
      setPasswordFolder(null);
      openExplorer(folderName);
    },
    [openExplorer],
  );

  const handleViewerClose = useCallback(
    (windowId: WindowId, result: RdpFileViewedResult): void => {
      closeWindow(windowId);
      setVersion(result.version);

      if (result.triggered && result.scenarioFinal) {
        const sf = result.scenarioFinal;
        setStage({ phase: 'triggered', scenarioFinal: sf });
        onTriggeredRef.current(sf, result.version);
      }
    },
    [closeWindow],
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  const isBrowsing = stage.phase === 'browsing';
  const passwordZIndex = 10 + windowOrder.length + 20;

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

      {/* Triggered placeholder — seam for Task 4 */}
      {stage.phase === 'triggered' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <p className="font-mono text-game-sm text-white drop-shadow" role="status">
            Сессия завершена. Файлы скрыты.
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
