'use client';

import { useState } from 'react';

interface BanUserDialogProps {
  userId: string;
  userEmail: string;
  currentIsBlocked: boolean;
  onSuccess: (updatedIsBlocked: boolean) => void;
  onClose: () => void;
}

export function BanUserDialog({
  userId,
  userEmail,
  currentIsBlocked,
  onSuccess,
  onClose,
}: BanUserDialogProps): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newIsBlocked = !currentIsBlocked;
  const title = currentIsBlocked ? 'Разблокировать пользователя' : 'Заблокировать пользователя';

  const handleConfirm = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: newIsBlocked }),
      });
      if (!res.ok) throw new Error('Ошибка запроса');
      onSuccess(newIsBlocked);
      onClose();
    } catch {
      setError('Не удалось выполнить операцию. Попробуйте ещё раз.');
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
        className="bg-white rounded-xl shadow-admin-card w-full max-w-md mx-4 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-admin-input-text mb-3">{title}</h2>

        <p className="text-sm text-admin-placeholder mb-2">
          Пользователь: <span className="text-admin-label font-medium">{userEmail}</span>
        </p>

        {!currentIsBlocked && (
          <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
            Игрок не будет разлогинен мгновенно — доступ прекратится при следующей сессии.
          </p>
        )}

        <p className="text-sm text-admin-placeholder mb-6">
          Эта операция требует подтверждения.
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
            onClick={handleConfirm}
            disabled={loading}
            className="px-6 py-2 rounded-lg text-sm text-white bg-admin-input-text hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Загрузка...' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  );
}
