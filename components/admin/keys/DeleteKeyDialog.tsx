'use client';

import { useState } from 'react';

interface DeleteKeyDialogProps {
  keyValue: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteKeyDialog({
  keyValue,
  onClose,
  onConfirm,
}: DeleteKeyDialogProps): React.ReactElement {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    setLoading(true);
    try {
      await onConfirm();
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
        <h2 className="text-base font-semibold text-admin-accent mb-4">
          Подтверждение удаления
        </h2>

        <p className="text-sm font-semibold text-admin-input-text mb-2">
          Вы уверены?
        </p>
        <p className="text-sm text-admin-label mb-1">
          Ключ:{' '}
          <span className="font-mono font-medium text-admin-input-text">
            {keyValue}
          </span>
        </p>
        <p className="text-sm text-admin-label mt-2">
          Удаление ключей может привести к удалению других данных.
        </p>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-admin-label border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Отменить
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-white bg-admin-input-text hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Удаление...' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}
