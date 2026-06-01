'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface BlockKeyDialogProps {
  keyValue: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function BlockKeyDialog({
  keyValue,
  onClose,
  onConfirm,
}: BlockKeyDialogProps): React.ReactElement {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    setLoading(true);
    try {
      await onConfirm(reason);
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
        className="bg-white rounded-xl shadow-admin-card w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-admin-accent">
            Блокировка ключа
          </h2>
          <button
            onClick={onClose}
            className="text-admin-placeholder hover:text-admin-input-text transition-colors"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-admin-label mb-4">
          Ключ:{' '}
          <span className="font-mono font-medium text-admin-input-text">
            {keyValue}
          </span>
        </p>

        <label
          htmlFor="blockReason"
          className="block text-sm text-admin-label mb-1"
        >
          Причина блокировки{' '}
          <span className="text-admin-placeholder">(опционально)</span>
        </label>
        <textarea
          id="blockReason"
          className="w-full rounded-lg bg-admin-input-bg text-admin-input-text text-sm px-3 py-2 resize-none border border-transparent focus:outline-none focus:border-admin-accent transition-colors"
          rows={3}
          placeholder="Введите причину..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-admin-label border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Отменить
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? 'Сохранение...' : 'Заблокировать'}
          </button>
        </div>
      </div>
    </div>
  );
}
