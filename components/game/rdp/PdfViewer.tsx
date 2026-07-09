'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';
import NextImage from 'next/image';

import { fetchWithVersion } from '@/lib/api/fetchWithVersion';
import { toast } from '@/components/ui/Toast';
import type { RdpFileView, RdpFileViewedResult } from '@/types/rdp';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg']);

function isImageFile(file: RdpFileView): boolean {
  const source = file.url ?? file.name;
  const ext = source.split('?')[0].split('.').pop()?.toLowerCase();
  return ext !== undefined && IMAGE_EXTENSIONS.has(`.${ext}`);
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface PdfViewerProps {
  file: RdpFileView;
  slotKey: string;
  version: number;
  zIndex: number;
  positionOffset: number;
  onClose: (result: RdpFileViewedResult) => void;
  onFocus: () => void;
  onConflict: () => Promise<void>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PdfViewer({
  file,
  slotKey,
  version,
  zIndex,
  positionOffset,
  onClose,
  onFocus,
  onConflict,
}: PdfViewerProps): ReactElement {
  const [closing, setClosing] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [zoom, setZoom] = useState(100);

  const ZOOM_STEPS = [50, 75, 100, 125, 150] as const;

  const zoomOut = (): void => {
    setZoom((prev) => {
      const idx = ZOOM_STEPS.indexOf(prev as typeof ZOOM_STEPS[number]);
      return idx > 0 ? ZOOM_STEPS[idx - 1] : prev;
    });
  };

  const zoomIn = (): void => {
    setZoom((prev) => {
      const idx = ZOOM_STEPS.indexOf(prev as typeof ZOOM_STEPS[number]);
      return idx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[idx + 1] : prev;
    });
  };

  const top = 60 + positionOffset * 25;
  const left = 200 + positionOffset * 25;

  const handleClose = async (): Promise<void> => {
    setClosing(true);

    try {
      const res = await fetchWithVersion(`/api/missions/rdp/${slotKey}/file-viewed`, {
        body: { fileId: file.id, expectedVersion: version },
        onConflict,
      });

      if (res.status === 409) {
        // onConflict was called by fetchWithVersion; parent refetches and
        // re-renders this component with an updated version prop
        setClosing(false);
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        console.error('[PdfViewer.handleClose]', data.error);
        toast.error('Не удалось закрыть файл. Попробуйте еще раз.');
        setClosing(false);
        return;
      }

      const result = (await res.json()) as RdpFileViewedResult;
      onClose(result);
    } catch (err) {
      console.error('[PdfViewer.handleClose]', err);
      toast.error('Ошибка соединения.');
      setClosing(false);
    }
  };

  // When maximized — fill the entire simulation container (inset-0 overrides top/left)
  const containerStyle = maximized ? { zIndex } : { zIndex, top, left };
  const containerClass = maximized
    ? 'absolute inset-0 shadow-2xl overflow-hidden border border-gray-300 select-none flex flex-col'
    : 'absolute w-80 shadow-2xl overflow-hidden border border-gray-300 select-none flex flex-col';

  return (
    <div
      style={containerStyle}
      onMouseDown={onFocus}
      className={containerClass}
      role="dialog"
      aria-label={`Просмотр: ${file.name}`}
    >
      {/* Titlebar */}
      <div className="flex shrink-0 items-center gap-2 bg-gray-100 border-b border-gray-200 px-3 py-1.5">
        <span className="flex-1 font-sans text-sm text-gray-800 font-medium">Скан</span>

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 mr-2">
          <button
            type="button"
            onClick={zoomOut}
            disabled={zoom === 50}
            aria-label="Уменьшить"
            className="flex size-6 items-center justify-center rounded-sm hover:bg-gray-300 text-gray-700 disabled:opacity-40 font-mono text-sm leading-none"
          >
            −
          </button>
          <span className="w-10 text-center font-sans text-xs text-gray-600 select-none tabular-nums">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={zoom === 150}
            aria-label="Увеличить"
            className="flex size-6 items-center justify-center rounded-sm hover:bg-gray-300 text-gray-700 disabled:opacity-40 font-mono text-sm leading-none"
          >
            +
          </button>
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setMaximized((v) => !v)}
            aria-label={maximized ? 'Восстановить размер' : 'Развернуть на весь экран'}
            className="flex size-6 items-center justify-center rounded-sm hover:bg-gray-300 text-gray-700"
          >
            {maximized ? <RestoreIcon /> : <MaximizeIcon />}
          </button>

          <button
            type="button"
            onClick={() => void handleClose()}
            disabled={closing}
            aria-label="Закрыть"
            className="flex size-6 items-center justify-center rounded-sm hover:bg-red-500 hover:text-white text-gray-700 disabled:opacity-50"
          >
            {closing ? (
              <span
                className="size-3 animate-spin rounded-full border border-current border-t-transparent"
                aria-hidden="true"
              />
            ) : (
              <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
                <path
                  d="M1 1l7 7M8 1l-7 7"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* File content */}
      {file.url ? (
        isImageFile(file) ? (
          <div
            className="flex-1 bg-white overflow-auto p-2"
            style={{ height: maximized ? '100%' : '420px' }}
          >
            <NextImage
              src={file.url}
              alt={file.name}
              width={0}
              height={0}
              sizes="100vw"
              unoptimized
              style={{ width: `${zoom}%`, height: 'auto', display: 'block', margin: '0 auto' }}
            />
          </div>
        ) : (
          <div className="flex-1 bg-white overflow-hidden">
            <iframe
              key={zoom}
              src={`${file.url}#toolbar=0&zoom=${zoom}`}
              title={file.name}
              className="w-full border-0 block"
              aria-label={`Документ: ${file.name}`}
              style={{ height: maximized ? '100%' : '420px' }}
            />
          </div>
        )
      ) : (
        <div className="flex-1 bg-white flex items-center justify-center" style={{ minHeight: '420px' }}>
          <p className="font-sans text-sm text-gray-400">Файл недоступен</p>
        </div>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function MaximizeIcon(): ReactElement {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="8" height="8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function RestoreIcon(): ReactElement {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      {/* back square (top-right offset) */}
      <rect x="3" y="0.5" width="7" height="7" stroke="currentColor" strokeWidth="1" />
      {/* front square (bottom-left offset), filled white to "cut out" overlap */}
      <rect x="0.5" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1" fill="white" />
    </svg>
  );
}
