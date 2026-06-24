'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminAuditLogItem, AdminDetail as AdminDetailType } from '@/types/admin-admins';
import { NewPasswordModal } from './NewPasswordModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

const SEARCH_DEBOUNCE_MS = 400;

interface AdminDetailProps {
  admin: AdminDetailType;
  currentAdminId: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function AdminDetail({
  admin,
  currentAdminId,
}: AdminDetailProps): React.ReactElement {
  const router = useRouter();
  const isSelf = admin.id === currentAdminId;

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const [logs, setLogs] = useState<AdminAuditLogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsLoadingMore, setLogsLoadingMore] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLogs = useCallback(
    async (searchQuery: string, cursor?: string): Promise<void> => {
      const isLoadMore = Boolean(cursor);
      if (isLoadMore) {
        setLogsLoadingMore(true);
      } else {
        setLogsLoading(true);
        setLogsError(null);
      }

      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        if (cursor) params.set('cursor', cursor);

        const res = await fetch(
          `/api/admin/admins/${admin.id}/audit-logs?${params.toString()}`,
        );

        if (!res.ok) {
          setLogsError('Не удалось загрузить историю операций.');
          return;
        }

        const data = (await res.json()) as {
          logs: AdminAuditLogItem[];
          nextCursor: string | null;
        };

        if (isLoadMore) {
          setLogs((prev) => [...prev, ...data.logs]);
        } else {
          setLogs(data.logs);
        }
        setNextCursor(data.nextCursor);
      } catch {
        setLogsError('Не удалось загрузить историю операций.');
      } finally {
        setLogsLoading(false);
        setLogsLoadingMore(false);
      }
    },
    [admin.id],
  );

  useEffect(() => {
    void fetchLogs('');
  }, [fetchLogs]);

  const handleSearchChange = (value: string): void => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchLogs(value);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleResetPassword = async (): Promise<void> => {
    setPasswordLoading(true);
    setPasswordError(null);

    try {
      const res = await fetch(`/api/admin/admins/${admin.id}/password`, {
        method: 'PATCH',
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordError('Не удалось сбросить пароль. Попробуйте еще раз.');
        return;
      }

      setGeneratedPassword(data.password as string);
    } catch {
      setPasswordError('Не удалось сбросить пароль. Попробуйте еще раз.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/admin/admins/${admin.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'CANNOT_DELETE_SELF') {
          setDeleteError('Нельзя удалить собственную учетную запись.');
        } else if (data.error === 'CANNOT_DELETE_LAST_ADMIN') {
          setDeleteError('Нельзя удалить последнего администратора.');
        } else {
          setDeleteError('Не удалось удалить администратора. Попробуйте еще раз.');
        }

        setDeleteLoading(false);
        return;
      }

      router.push('/admin/admins');
    } catch {
      setDeleteError('Не удалось удалить администратора. Попробуйте еще раз.');
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-xl font-semibold text-admin-accent mb-6">
        Управление администраторами
      </h1>

      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-8 mb-4">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Общая информация */}
          <div className="flex-1">
            <h2 className="text-base font-semibold text-admin-input-text mb-6">
              Общая информация
            </h2>

            <dl className="space-y-4">
              <div className="flex items-center gap-3">
                <dt className="w-40 text-sm text-admin-label shrink-0">
                  Email :
                </dt>
                <dd className="text-sm text-admin-input-text">{admin.email}</dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="w-40 text-sm text-admin-label shrink-0">
                  Дата регистрации :
                </dt>
                <dd className="text-sm text-admin-input-text">
                  {formatDate(admin.createdAt)}
                </dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="w-40 text-sm text-admin-label shrink-0">
                  Последний вход :
                </dt>
                <dd className="text-sm text-admin-input-text">
                  {admin.lastLoginAt ? formatDate(admin.lastLoginAt) : '—'}
                </dd>
              </div>

              <div className="flex items-center gap-3">
                <dt className="w-40 text-sm text-admin-label shrink-0">
                  Статус :
                </dt>
                <dd className="text-sm text-emerald-600">активный</dd>
              </div>
            </dl>
          </div>

          {/* Пароль */}
          <div className="lg:w-72">
            <h2 className="text-base font-semibold text-admin-input-text mb-6">
              Пароль
            </h2>

            <p className="text-sm text-admin-placeholder mb-5">
              Сгенерировать новый пароль для администратора. Текущий пароль
              будет сброшен.
            </p>

            {passwordError && (
              <p className="text-sm text-red-600 mb-3">{passwordError}</p>
            )}

            <button
              onClick={handleResetPassword}
              disabled={passwordLoading}
              className="w-full px-4 py-2.5 rounded-lg text-sm text-white bg-admin-input-text hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {passwordLoading ? 'Генерация...' : 'Сгенерировать пароль'}
            </button>
          </div>
        </div>
      </div>

      {/* История операций */}
      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-8 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <h2 className="text-base font-semibold text-admin-input-text shrink-0">
            История операций
          </h2>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Поиск по тексту операции..."
            className="w-full sm:w-72 px-4 py-2 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border border-transparent focus:border-admin-accent focus:outline-none placeholder:text-admin-placeholder transition-colors"
          />
        </div>

        {logsLoading ? (
          <p className="text-sm text-admin-placeholder">Загрузка...</p>
        ) : logsError ? (
          <p className="text-sm text-red-500">{logsError}</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-admin-placeholder">
            {search ? 'Операций по запросу не найдено' : 'Операций не найдено'}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-admin-card-border">
              {logs.map((log) => (
                <li key={log.id} className="flex items-center justify-between py-3">
                  <span className="text-sm text-admin-input-text">{log.message}</span>
                  <span className="text-xs text-admin-placeholder shrink-0 ml-4">
                    {new Date(log.createdAt).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>

            {nextCursor && (
              <div className="flex justify-center mt-5">
                <button
                  onClick={() => void fetchLogs(search, nextCursor)}
                  disabled={logsLoadingMore}
                  className="px-5 py-2 rounded-lg text-sm text-admin-input-text border border-admin-card-border hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {logsLoadingMore ? 'Загрузка...' : 'Загрузить еще'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Нижняя панель действий */}
      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border px-8 py-5 flex items-center justify-between">
        <div>
          {isSelf && (
            <p className="text-sm text-red-500">
              Нельзя удалить текущего администратора
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/admin/admins')}
            className="px-6 py-2 rounded-lg text-sm text-admin-input-text border border-admin-card-border hover:bg-gray-50 transition-colors"
          >
            Отменить
          </button>
          <button
            onClick={() => {
              if (!isSelf) setShowDeleteModal(true);
            }}
            disabled={isSelf}
            className="px-6 py-2 rounded-lg text-sm text-white bg-admin-input-text hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Удалить
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <ConfirmDeleteModal
          loading={deleteLoading}
          error={deleteError}
          onConfirm={handleDelete}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteError(null);
          }}
        />
      )}

      {generatedPassword && (
        <NewPasswordModal
          password={generatedPassword}
          title="Пароль сброшен"
          onClose={() => setGeneratedPassword(null)}
        />
      )}
    </>
  );
}
