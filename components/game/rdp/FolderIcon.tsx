'use client';

import Image from 'next/image';
import type { ReactElement } from 'react';

import type { RdpFolderView } from '@/types/rdp';

interface FolderIconProps {
  folder: RdpFolderView;
  onDoubleClick: (folderName: string) => void;
}

export function FolderIcon({ folder, onDoubleClick }: FolderIconProps): ReactElement {
  const isPassworded = folder.isLocked && !folder.isUnlocked;

  return (
    <button
      type="button"
      onDoubleClick={() => onDoubleClick(folder.folderName)}
      aria-label={`${folder.folderName}${isPassworded ? ' (защищено паролем)' : ''}`}
      className="flex flex-col items-center gap-1 rounded px-2 py-2 hover:bg-white/20 focus:outline-none focus:ring-1 focus:ring-white/50 select-none cursor-default"
    >
      <Image
        src={isPassworded ? '/assets/desctop/folder_close.png' : '/assets/desctop/folder.png'}
        alt=""
        width={48}
        height={48}
        aria-hidden="true"
      />
      <span className="font-sans text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-center max-w-[72px] break-words leading-tight">
        {folder.folderName}
      </span>
    </button>
  );
}
