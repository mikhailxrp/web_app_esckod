'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { ActivationsExportFilter } from '@/types/admin-keys';

type StatusExport = 'all' | 'active' | 'blocked';

const STATUS_OPTIONS: { value: StatusExport; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'blocked', label: 'Заблокированные' },
];

const ACTIVATIONS_EXPORT_OPTIONS: {
  value: ActivationsExportFilter;
  label: string;
}[] = [
  { value: 'all', label: 'Все' },
  { value: 'none', label: 'Нет активаций' },
  {
    value: 'mid',
    label: 'В процессе (есть активации, лимит не достигнут)',
  },
  { value: 'near_limit', label: 'Близко к лимиту (осталась 1 активация)' },
  { value: 'at_limit', label: 'Лимит исчерпан' },
];

interface ExportKeysModalProps {
  onClose: () => void;
}

export function ExportKeysModal({
  onClose,
}: ExportKeysModalProps): React.ReactElement {
  const [filterByStatus, setFilterByStatus] = useState(false);
  const [filterByActivations, setFilterByActivations] = useState(false);
  const [status, setStatus] = useState<StatusExport>('all');
  const [activationsExport, setActivationsExport] =
    useState<ActivationsExportFilter>('all');

  const handleExport = (): void => {
    const params = new URLSearchParams();
    if (filterByStatus) params.set('status', status);
    if (filterByActivations) params.set('activationsExport', activationsExport);
    window.location.href = `/api/admin/keys/export?${params.toString()}`;
    onClose();
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
        <div className="flex items-center justify-between mb-5">
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

        <div className="space-y-4">
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
              Выгрузка по статусу
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusExport)}
              disabled={!filterByStatus}
              className="rounded-lg bg-admin-input-bg text-admin-input-text text-sm px-3 py-1.5 border border-transparent focus:outline-none focus:border-admin-accent disabled:opacity-40 w-36 cursor-pointer disabled:cursor-default transition-colors"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="exportActivations"
              checked={filterByActivations}
              onChange={(e) => setFilterByActivations(e.target.checked)}
              className="accent-admin-accent w-4 h-4 cursor-pointer"
            />
            <label
              htmlFor="exportActivations"
              className="text-sm text-admin-label flex-1 cursor-pointer"
            >
              Выгрузка по лимиту активаций
            </label>
            <select
              value={activationsExport}
              onChange={(e) =>
                setActivationsExport(e.target.value as ActivationsExportFilter)
              }
              disabled={!filterByActivations}
              className="rounded-lg bg-admin-input-bg text-admin-input-text text-sm px-3 py-1.5 border border-transparent focus:outline-none focus:border-admin-accent disabled:opacity-40 w-36 cursor-pointer disabled:cursor-default transition-colors"
            >
              {ACTIVATIONS_EXPORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={handleExport}
            className="px-5 py-2 rounded-lg text-sm text-white bg-admin-input-text hover:bg-gray-800 transition-colors"
          >
            Выгрузить
          </button>
        </div>
      </div>
    </div>
  );
}
