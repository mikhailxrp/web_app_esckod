'use client';

import Image from 'next/image';
import type { ReactElement } from 'react';

import type { RdpFileView, RdpFolderView } from '@/types/rdp';

// ─── Constants ───────────────────────────────────────────────────────────────

const SIDEBAR_ITEMS = ['Этот компьютер', 'Рабочий стол', 'Загрузки', 'Документы'];

// ─── Props ───────────────────────────────────────────────────────────────────

interface FolderContentProps {
  folder: RdpFolderView;
  zIndex: number;
  positionOffset: number;
  onClose: () => void;
  onMinimize: () => void;
  onFocus: () => void;
  onFileOpen: (file: RdpFileView) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FolderContent({
  folder,
  zIndex,
  positionOffset,
  onClose,
  onMinimize,
  onFocus,
  onFileOpen,
}: FolderContentProps): ReactElement {
  const top = 30 + positionOffset * 25;
  const left = 30 + positionOffset * 25;

  return (
    <div
      style={{ zIndex, top, left }}
      onMouseDown={onFocus}
      className="absolute w-[600px] max-w-[calc(100%-60px)] shadow-2xl overflow-hidden border border-gray-300 select-none"
      role="dialog"
      aria-label={`Проводник — ${folder.folderName}`}
    >
      {/* Titlebar */}
      <div className="flex items-center gap-2 bg-gray-100 border-b border-gray-200 px-3 py-1.5">
        <Image src="/assets/desctop/folder.png" alt="" width={16} height={16} aria-hidden="true" />
        <span className="flex-1 font-sans text-sm text-gray-800 font-medium">
          {folder.folderName}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onMinimize}
            aria-label="Свернуть"
            className="flex size-6 items-center justify-center rounded-sm hover:bg-gray-300 text-gray-700"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" aria-hidden="true">
              <path d="M0 0.5h10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Развернуть"
            className="flex size-6 items-center justify-center rounded-sm hover:bg-gray-300 text-gray-700"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
              <rect x="0.5" y="0.5" width="8" height="8" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex size-6 items-center justify-center rounded-sm hover:bg-red-500 hover:text-white text-gray-700"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
              <path
                d="M1 1l7 7M8 1l-7 7"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 bg-white border-b border-gray-200 px-3 py-1.5">
        <Image src="/assets/desctop/folder.png" alt="" width={14} height={14} aria-hidden="true" />
        <span className="font-sans text-xs text-gray-500">Этот компьютер</span>
        <BreadcrumbChevron />
        <span className="font-sans text-xs text-gray-500">Рабочий стол</span>
        <BreadcrumbChevron />
        <span className="font-sans text-xs text-gray-800">{folder.folderName}</span>
      </div>

      {/* Body */}
      <div className="flex bg-white" style={{ minHeight: '280px' }}>
        {/* Sidebar */}
        <div className="w-36 shrink-0 border-r border-gray-200 py-2">
          {SIDEBAR_ITEMS.map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 px-3 py-1 cursor-default hover:bg-blue-50"
            >
              <Image
                src="/assets/desctop/folder.png"
                alt=""
                width={14}
                height={14}
                aria-hidden="true"
              />
              <span className="font-sans text-xs text-gray-700 truncate">{item}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-auto">
          {folder.files.length === 0 ? (
            <p className="font-sans text-xs text-gray-400 mt-4 text-center">Папка пуста</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {folder.files.map((file) => (
                <FileItem key={file.id} file={file} onOpen={onFileOpen} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BreadcrumbChevron(): ReactElement {
  return (
    <svg
      width="6"
      height="10"
      viewBox="0 0 6 10"
      fill="none"
      aria-hidden="true"
      className="text-gray-400 shrink-0"
    >
      <path
        d="M1 1.5l4 3.5-4 3.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface FileItemProps {
  file: RdpFileView;
  onOpen: (file: RdpFileView) => void;
}

function FileItem({ file, onOpen }: FileItemProps): ReactElement {
  const canOpen = file.url !== null;

  return (
    <button
      type="button"
      onDoubleClick={() => {
        if (canOpen) onOpen(file);
      }}
      aria-label={`${file.name}${!canOpen ? ' (недоступно)' : ''}`}
      disabled={!canOpen}
      className="flex flex-col items-center gap-1 rounded px-2 py-2 hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-200 cursor-default disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Image
        src="/assets/desctop/document_icon.png"
        alt=""
        width={36}
        height={36}
        aria-hidden="true"
      />
      <span className="font-sans text-xs text-gray-700 text-center max-w-[72px] break-words leading-tight">
        {file.name}
      </span>
    </button>
  );
}
