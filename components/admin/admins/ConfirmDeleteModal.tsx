'use client';

interface ConfirmDeleteModalProps {
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDeleteModal({
  loading,
  error,
  onConfirm,
  onClose,
}: ConfirmDeleteModalProps): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-admin-card w-full max-w-md mx-4 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-admin-input-text mb-3">
          Вы уверены?
        </h2>

        <p className="text-sm text-admin-label mb-6">
          Данная операция необратима.
        </p>

        {error && (
          <p className="text-sm text-red-600 mb-4">{error}</p>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 rounded-lg text-sm text-admin-input-text border border-admin-card-border hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Отменить
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-6 py-2 rounded-lg text-sm text-white bg-admin-input-text hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Удаление...' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  );
}
