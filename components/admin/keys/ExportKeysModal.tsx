'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

type StatusExport = 'all' | 'active' | 'blocked';
type ActivationsExport = 'all' | 'lt5' | 'eq5' | 'gt5';

const STATUS_OPTIONS: { value: StatusExport; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'blocked', label: 'Заблокированные' },
];

const ACTIVATIONS_OPTIONS: { value: ActivationsExport; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'lt5', label: 'Менее 5' },
  { value: 'eq5', label: '5 активаций' },
  { value: 'gt5', label: 'Более 5' },
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
  const [activations, setActivations] = useState<ActivationsExport>('all');

  const handleExport = (): void => {
    const params = new URLSearchParams();
    if (filterByStatus) params.set('status', status);
    if (filterByActivations) params.set('activations', activations);
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
              Выгрузка по количеству активаций
            </label>
            <select
              value={activations}
              onChange={(e) =>
                setActivations(e.target.value as ActivationsExport)
              }
              disabled={!filterByActivations}
              className="rounded-lg bg-admin-input-bg text-admin-input-text text-sm px-3 py-1.5 border border-transparent focus:outline-none focus:border-admin-accent disabled:opacity-40 w-36 cursor-pointer disabled:cursor-default transition-colors"
            >
              {ACTIVATIONS_OPTIONS.map((opt) => (
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
