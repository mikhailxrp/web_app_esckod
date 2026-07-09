'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

export function DevResetAllButton(): React.ReactElement {
  const [status, setStatus] = useState<'idle' | 'confirming' | 'loading' | 'done' | 'error'>('idle');
  const [affectedUsers, setAffectedUsers] = useState<number>(0);

  function handleClick(): void {
    if (status === 'loading') return;
    setStatus('confirming');
  }

  function handleCancel(): void {
    setStatus('idle');
  }

  async function handleConfirm(): Promise<void> {
    setStatus('loading');
    try {
      const res = await fetch('/api/admin/dev/reset-all', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { success: boolean; affectedUsers: number };
      setAffectedUsers(data.affectedUsers);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'confirming') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-300 bg-red-50 text-sm">
        <span className="text-red-700 font-medium">
          Сбросить прогресс всех игроков? Это необратимо.
        </span>
        <button
          onClick={handleConfirm}
          className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
        >
          Да, сбросить
        </button>
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 rounded-lg border border-admin-card-border text-admin-label hover:bg-gray-100 transition-colors"
        >
          Отмена
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-admin-card-border text-sm text-admin-label">
        <RotateCcw size={16} className="animate-spin" />
        Сброс...
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-300 bg-green-50 text-sm">
        <span className="text-green-700 font-medium">
          Готово — сброшено для {affectedUsers} игроков
        </span>
        <button
          onClick={() => setStatus('idle')}
          className="px-3 py-1.5 rounded-lg border border-admin-card-border text-admin-label hover:bg-gray-100 transition-colors text-xs"
        >
          Закрыть
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-300 bg-red-50 text-sm">
        <span className="text-red-700 font-medium">Ошибка — попробуй снова</span>
        <button
          onClick={() => setStatus('idle')}
          className="px-3 py-1.5 rounded-lg border border-admin-card-border text-admin-label hover:bg-gray-100 transition-colors text-xs"
        >
          Закрыть
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-300 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors"
    >
      <RotateCcw size={16} />
      [DEV] Сбросить прогресс всех игроков
    </button>
  );
}
