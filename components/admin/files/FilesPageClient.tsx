'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RdpSlotData, FolderPasswordMap } from '@/types/admin-files';
import { FilesTable } from './FilesTable';
import { FileUploadSection } from './FileUploadSection';
import { FolderModal } from './FolderModal';

interface FilesPageClientProps {
  slots: RdpSlotData[];
  folderPasswords: FolderPasswordMap;
}

interface OpenFolder {
  slotId: string;
  slotName: string;
  folder: string;
}

export function FilesPageClient({
  slots,
  folderPasswords,
}: FilesPageClientProps): React.ReactElement {
  const router = useRouter();
  const [openFolder, setOpenFolder] = useState<OpenFolder | null>(null);

  const handleFolderOpen = useCallback(
    (slotId: string, slotName: string, folder: string) => {
      setOpenFolder({ slotId, slotName, folder });
    },
    [],
  );

  const handleClose = useCallback(() => {
    setOpenFolder(null);
  }, []);

  const handleMutated = useCallback(() => {
    router.refresh();
  }, [router]);

  const modalSlot = openFolder
    ? slots.find((s) => s.id === openFolder.slotId)
    : null;

  const modalFiles = modalSlot
    ? modalSlot.files.filter((f) => f.folder === openFolder!.folder)
    : [];

  const modalIsLocked = modalFiles[0]?.isLocked ?? false;

  const modalPassword = modalSlot
    ? (folderPasswords[`${modalSlot.slotKey}::${openFolder!.folder}`] ?? null)
    : null;

  return (
    <div className="flex flex-col gap-8">
      <FileUploadSection slots={slots} onSuccess={handleMutated} />
      <FilesTable slots={slots} onFolderClick={handleFolderOpen} />

      {openFolder && modalSlot && (
        <FolderModal
          slotId={openFolder.slotId}
          slotName={openFolder.slotName}
          folder={openFolder.folder}
          files={modalFiles}
          isLocked={modalIsLocked}
          folderPassword={modalPassword}
          onClose={handleClose}
          onMutated={() => {
            handleMutated();
          }}
        />
      )}
    </div>
  );
}
