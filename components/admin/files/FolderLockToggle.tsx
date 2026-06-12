'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface FolderLockToggleProps {
  slotId: string;
  folder: string;
  isLocked: boolean;
  onMutated: () => void;
}

export function FolderLockToggle({
  slotId,
  folder,
  isLocked,
  onMutated,
}: FolderLockToggleProps): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentValue, setCurrentValue] = useState(isLocked);

  async function handleChange(
    e: React.ChangeEvent<HTMLSelectElement>,
  ): Promise<void> {
    const newValue = e.target.value === 'true';
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/admin/files/folder/lock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, folder, isLocked: newValue }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string; error?: string };
        setError(data.message ?? data.error ?? 'Не удалось изменить статус');
        return;
      }

      setCurrentValue(newValue);
      onMutated();
    } catch {
      setError('Не удалось выполнить запрос. Проверьте соединение.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-center gap-2">
        <select
          value={String(currentValue)}
          onChange={(e) => void handleChange(e)}
          disabled={loading}
          aria-label="Зашифрована"
          className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-8 text-sm text-gray-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="true">Да</option>
          <option value="false">Нет</option>
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            '▾'
          )}
        </span>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
