'use client';

import type { RdpSlotData } from '@/types/admin-files';

interface FilesTableProps {
  slots: RdpSlotData[];
  onFolderClick: (slotId: string, slotName: string, folder: string) => void;
}

export function FilesTable({
  slots,
  onFolderClick,
}: FilesTableProps): React.ReactElement {
  const rows: { num: number; slotId: string; slotName: string; folder: string; fileName: string; fileUrl: string }[] = [];
  let counter = 1;

  for (const slot of slots) {
    for (const file of slot.files) {
      rows.push({
        num: counter++,
        slotId: slot.id,
        slotName: slot.name,
        folder: file.folder,
        fileName: file.name,
        fileUrl: file.url,
      });
    }
  }

  return (
    <div className="rounded-xl border border-admin-card-border bg-white dark:bg-gray-900">
      <div className="border-b border-admin-card-border px-4 py-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Список файлов
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-admin-card-border bg-gray-50 dark:bg-gray-800/50">
              <th className="w-14 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                №
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                Слот миссии
              </th>
              <th className="w-36 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                Папка
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                Файл
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500"
                >
                  Файлы не загружены
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={`${row.slotId}-${row.folder}-${row.fileName}`}
                  className="border-b border-admin-card-border last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                >
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-xs font-medium text-gray-500 dark:text-gray-400">
                      {row.num}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {row.slotName}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onFolderClick(row.slotId, row.slotName, row.folder)}
                      className="rounded bg-gray-800 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600"
                      aria-label={`Открыть папку ${row.folder}`}
                    >
                      {row.folder}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={row.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {row.fileName}
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="border-t border-admin-card-border px-4 py-2 text-xs text-gray-400 dark:text-gray-500">
          Всего: {rows.length}
        </div>
      )}
    </div>
  );
}
