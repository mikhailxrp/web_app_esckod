'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import type { AccessKeyDetail, AccessKeyUser, KeyAuditEntry } from '@/types/admin-keys';
import { BlockKeyDialog } from './BlockKeyDialog';
import { DeleteKeyDialog } from './DeleteKeyDialog';

type HistoryEntry =
  | { kind: 'activation'; user: AccessKeyUser }
  | { kind: 'audit'; log: KeyAuditEntry };

function buildHistory(detail: AccessKeyDetail): HistoryEntry[] {
  const activations: HistoryEntry[] = detail.users.map((u) => ({
    kind: 'activation',
    user: u,
  }));
  const audits: HistoryEntry[] = detail.auditLogs.map((l) => ({
    kind: 'audit',
    log: l,
  }));

  return [...activations, ...audits].sort((a, b) => {
    const dateA =
      a.kind === 'activation' ? new Date(a.user.createdAt) : new Date(a.log.createdAt);
    const dateB =
      b.kind === 'activation' ? new Date(b.user.createdAt) : new Date(b.log.createdAt);
    return dateA.getTime() - dateB.getTime();
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const AUDIT_LABELS: Record<string, { label: string; color: string }> = {
  key_blocked: { label: 'Деактивирован', color: 'text-red-500' },
  key_unblocked: { label: 'Активирован', color: 'text-green-600' },
};

interface KeyRowDetailsProps {
  detail: AccessKeyDetail | null;
  onCollapse: () => void;
  onSaveLimit: (maxActivations: number) => Promise<{ success: boolean; error?: string }>;
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
  const [limitError, setLimitError] = useState<string | null>(null);
  const [limitSuccess, setLimitSuccess] = useState(false);
  const limitSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (detail) {
      setLimitInput(String(detail.maxActivations));
    }
  }, [detail?.id, detail?.maxActivations]);
  const [activating, setActivating] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (!detail) {
    return (
      <td colSpan={5} className="px-4 py-6">
        <div className="flex items-center justify-center text-admin-placeholder">
          <Loader2 size={18} className="animate-spin mr-2" />
          <span className="text-sm">Загрузка...</span>
        </div>
      </td>
    );
  }

  const handleSaveLimit = async (): Promise<void> => {
    const value = parseInt(limitInput, 10);
    if (isNaN(value) || value < 1) {
      setLimitError('Лимит активации не может быть меньше 1');
      return;
    }
    setLimitError(null);
    setLimitSuccess(false);
    setSavingLimit(true);
    try {
      const result = await onSaveLimit(value);
      if (result.success) {
        setLimitSuccess(true);
        if (limitSuccessTimerRef.current) clearTimeout(limitSuccessTimerRef.current);
        limitSuccessTimerRef.current = setTimeout(() => setLimitSuccess(false), 3000);
      } else {
        setLimitError(result.error ?? 'Не удалось сохранить');
      }
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

  const history = buildHistory(detail);

  return (
    <>
      <td colSpan={3} className="px-4 py-3 align-bottom">
        <div className="flex flex-col gap-1 mb-1">
          <label
            htmlFor={`limit-${detail.id}`}
            className="text-xs text-admin-label"
          >
            Лимит активаций
          </label>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <input
                id={`limit-${detail.id}`}
                type="number"
                min={1}
                max={100}
                value={limitInput}
                onChange={(e) => {
                  setLimitInput(e.target.value);
                  setLimitError(null);
                }}
                className={`w-20 rounded-lg bg-admin-input-bg text-admin-input-text text-sm px-3 py-1.5 border focus:outline-none transition-colors ${limitError ? 'border-red-400' : 'border-transparent focus:border-admin-accent'}`}
              />
              <button
                onClick={handleSaveLimit}
                disabled={savingLimit}
                className="px-3 py-1.5 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors disabled:opacity-50"
              >
                {savingLimit ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
            {limitError && (
              <p className="text-xs text-red-500">{limitError}</p>
            )}
            {limitSuccess && (
              <p className="text-xs text-green-600">Лимит сохранен</p>
            )}
          </div>
        </div>

        {history.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-admin-input-text mb-2">История</p>
            <ul className="flex flex-col gap-1.5">
              {history.map((entry, i) => {
                if (entry.kind === 'activation') {
                  return (
                    <li key={`act-${entry.user.id}`} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-admin-accent shrink-0 mt-1" />
                      <span className="text-admin-label">
                        <span className="text-admin-input-text font-medium">
                          Активация —
                        </span>{' '}
                        {entry.user.email}
                        <span className="ml-2 text-admin-placeholder">
                          {formatDateTime(entry.user.createdAt)}
                        </span>
                      </span>
                    </li>
                  );
                }

                const meta = AUDIT_LABELS[entry.log.type] ?? {
                  label: entry.log.type,
                  color: 'text-admin-label',
                };
                return (
                  <li key={`audit-${i}`} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0 mt-1" />
                    <span className="text-admin-label">
                      <span className={`font-medium ${meta.color}`}>{meta.label}</span>
                      <span className="ml-2 text-admin-placeholder">
                        {formatDateTime(entry.log.createdAt)}
                      </span>
                      {entry.log.blockReason && (
                        <span className="ml-2 text-admin-label">
                          | Причина: {entry.log.blockReason}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </td>

      <td className="px-4 py-3 align-top">
        {detail.users.length === 0 ? (
          <p className="text-sm text-admin-placeholder italic mt-1">
            Нет пользователей
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 mt-1">
            {detail.users.map((user) => (
              <li
                key={user.id}
                className="flex items-center px-3 py-1.5 rounded-lg border border-admin-card-border bg-white text-sm text-admin-input-text shadow-sm"
              >
                {user.email}
              </li>
            ))}
          </ul>
        )}
      </td>

      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-2 items-end">
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

      </td>

      {showBlockDialog && createPortal(
        <BlockKeyDialog
          keyValue={detail.key}
          onClose={() => setShowBlockDialog(false)}
          onConfirm={handleBlock}
        />,
        document.getElementById('admin-portal-root') ?? document.body,
      )}

      {showDeleteDialog && createPortal(
        <DeleteKeyDialog
          keyValue={detail.key}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
        />,
        document.getElementById('admin-portal-root') ?? document.body,
      )}
    </>
  );
}
