'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

type StatusExport = 'all' | 'active' | 'blocked';

const STATUS_OPTIONS: { value: StatusExport; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'blocked', label: 'Заблокированные' },
];

interface ExportEmailsModalProps {
  onClose: () => void;
}

export function ExportEmailsModal({
  onClose,
}: ExportEmailsModalProps): React.ReactElement {
  const [exportWithConsent, setExportWithConsent] = useState(false);
  const [filterByStatus, setFilterByStatus] = useState(false);
  const [status, setStatus] = useState<StatusExport>('all');
  const [loading, setLoading] = useState(false);

  const handleExport = async (): Promise<void> => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterByStatus) params.set('status', status);

      const res = await fetch(`/api/admin/users/export?${params.toString()}`);
      if (!res.ok) throw new Error('Ошибка экспорта');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'users-emails.csv';
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      // no-op: файл просто не скачается
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-admin-card w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-admin-input-text">
            Параметры выгрузки
          </h2>
          <button
            onClick={onClose}
            className="text-admin-placeholder hover:text-admin-input-text transition-colors"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="exportConsent"
              checked={exportWithConsent}
              onChange={(e) => setExportWithConsent(e.target.checked)}
              className="accent-admin-accent w-4 h-4 cursor-pointer"
            />
            <label
              htmlFor="exportConsent"
              className="text-sm text-admin-label flex-1 cursor-pointer"
            >
              Выгрузка email (с согласием)
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="exportStatus"
              checked={filterByStatus}
              onChange={(e) => setFilterByStatus(e.target.checked)}
              className="accent-admin-accent w-4 h-4 cursor-pointer"
            />
            <label
              htmlFor="exportStatus"
              className="text-sm text-admin-label flex-1 cursor-pointer"
            >
              Выгрузка по статусу пользователей
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusExport)}
              disabled={!filterByStatus}
              className="rounded-lg bg-admin-input-bg text-admin-input-text text-sm px-3 py-1.5 border border-transparent focus:outline-none focus:border-admin-accent disabled:opacity-40 w-28 cursor-pointer disabled:cursor-default transition-colors"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleExport}
            disabled={loading}
            className="px-8 py-2 rounded-lg text-sm text-white bg-admin-input-text hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Загрузка...' : 'Выгрузить'}
          </button>
        </div>
      </div>
    </div>
  );
}
