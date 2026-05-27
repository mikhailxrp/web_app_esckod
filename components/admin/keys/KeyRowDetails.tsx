'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AccessKeyDetail } from '@/types/admin-keys';
import { BlockKeyDialog } from './BlockKeyDialog';
import { DeleteKeyDialog } from './DeleteKeyDialog';

interface KeyRowDetailsProps {
  detail: AccessKeyDetail | null;
  onCollapse: () => void;
  onSaveLimit: (maxActivations: number) => Promise<void>;
  onBlock: (reason: string) => Promise<void>;
  onActivate: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function KeyRowDetails({
  detail,
  onCollapse,
  onSaveLimit,
  onBlock,
  onActivate,
  onDelete,
}: KeyRowDetailsProps): React.ReactElement {
  const [limitInput, setLimitInput] = useState<string>(
    detail ? String(detail.maxActivations) : '',
  );
  const [savingLimit, setSavingLimit] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (!detail) {
    return (
      <div className="flex items-center justify-center py-6 text-admin-placeholder">
        <Loader2 size={18} className="animate-spin mr-2" />
        <span className="text-sm">Загрузка...</span>
      </div>
    );
  }

  const handleSaveLimit = async (): Promise<void> => {
    const value = parseInt(limitInput, 10);
    if (isNaN(value) || value < 1) return;
    setSavingLimit(true);
    try {
      await onSaveLimit(value);
    } finally {
      setSavingLimit(false);
    }
  };

  const handleActivate = async (): Promise<void> => {
    setActivating(true);
    try {
      await onActivate();
    } finally {
      setActivating(false);
    }
  };

  const handleBlock = async (reason: string): Promise<void> => {
    await onBlock(reason);
    setShowBlockDialog(false);
  };

  const handleDelete = async (): Promise<void> => {
    await onDelete();
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div className="flex gap-6 py-3">
        <div className="flex-1">
          {detail.users.length === 0 ? (
            <p className="text-sm text-admin-placeholder italic">
              Нет зарегистрированных пользователей
            </p>
          ) : (
            <ul className="space-y-1 mb-4">
              {detail.users.map((user) => (
                <li key={user.id} className="text-sm text-admin-label">
                  {user.email}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2 mt-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`limit-${detail.id}`}
                className="text-xs text-admin-label"
              >
                Лимит активаций
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`limit-${detail.id}`}
                  type="number"
                  min={1}
                  max={100}
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  className="w-20 rounded-lg bg-admin-input-bg text-admin-input-text text-sm px-3 py-1.5 border border-transparent focus:outline-none focus:border-admin-accent transition-colors"
                />
                <button
                  onClick={handleSaveLimit}
                  disabled={savingLimit}
                  className="px-3 py-1.5 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors disabled:opacity-50"
                >
                  {savingLimit ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end shrink-0">
          <button
            onClick={onCollapse}
            className="px-4 py-2 rounded-lg text-sm text-white bg-admin-input-text hover:bg-gray-800 transition-colors"
          >
            Свернуть
          </button>

          {detail.isBlocked ? (
            <button
              onClick={handleActivate}
              disabled={activating}
              className="px-4 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors disabled:opacity-50"
            >
              {activating ? 'Активация...' : 'Активировать'}
            </button>
          ) : (
            <button
              onClick={() => setShowBlockDialog(true)}
              className="px-4 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors"
            >
              Заблокировать
            </button>
          )}

          <button
            onClick={() => setShowDeleteDialog(true)}
            className="px-4 py-2 rounded-lg text-sm text-white bg-admin-input-text hover:bg-gray-800 transition-colors"
          >
            Удалить
          </button>
        </div>
      </div>

      {showBlockDialog && (
        <BlockKeyDialog
          keyValue={detail.key}
          onClose={() => setShowBlockDialog(false)}
          onConfirm={handleBlock}
        />
      )}

      {showDeleteDialog && (
        <DeleteKeyDialog
          keyValue={detail.key}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
