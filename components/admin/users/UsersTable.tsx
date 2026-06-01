'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import type { UserListItem, UserSortValue, UserStatusFilter } from '@/types/admin-users';
import { UsersFiltersPanel } from './UsersFiltersPanel';
import { BanUserDialog } from './BanUserDialog';
import { DeleteUserDialog } from './DeleteUserDialog';
import { ExportEmailsModal } from './ExportEmailsModal';

const LIMIT = 20;

interface UsersTableProps {
  initialData: UserListItem[];
  initialTotal: number;
  initialTotalPages: number;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const EDGE = 2;
  const leftSibling = Math.max(current - 1, 1);
  const rightSibling = Math.min(current + 1, total);
  const showLeftDots = leftSibling > EDGE + 1;
  const showRightDots = rightSibling < total - EDGE;

  const leftEdge = Array.from({ length: EDGE }, (_, i) => i + 1);
  const rightEdge = Array.from({ length: EDGE }, (_, i) => total - EDGE + 1 + i);

  if (!showLeftDots && showRightDots) {
    const leftRange = Array.from({ length: rightSibling + 1 }, (_, i) => i + 1);
    return [...leftRange, '...', ...rightEdge] as (number | '...')[];
  }

  if (showLeftDots && !showRightDots) {
    const rightRange = Array.from(
      { length: total - leftSibling + 1 },
      (_, i) => leftSibling + i,
    );
    return [...leftEdge, '...', ...rightRange];
  }

  if (showLeftDots && showRightDots) {
    const middle = Array.from(
      { length: rightSibling - leftSibling + 1 },
      (_, i) => leftSibling + i,
    );
    return [...leftEdge, '...', ...middle, '...', ...rightEdge];
  }

  return Array.from({ length: total }, (_, i) => i + 1);
}

interface BanDialogState {
  userId: string;
  userEmail: string;
  currentIsBlocked: boolean;
}

interface DeleteDialogState {
  userId: string;
  userEmail: string;
}

export function UsersTable({
  initialData,
  initialTotal,
  initialTotalPages,
}: UsersTableProps): React.ReactElement {
  const [users, setUsers] = useState<UserListItem[]>(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [page, setPage] = useState(1);

  const [inputQuery, setInputQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [status, setStatus] = useState<UserStatusFilter>('all');
  const [sort, setSort] = useState<UserSortValue>('createdAt_desc');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const [banDialog, setBanDialog] = useState<BanDialogState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doFetch = useCallback(
    async (
      p: number,
      q: string,
      st: UserStatusFilter,
      so: UserSortValue,
    ): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(LIMIT),
          status: st,
          sort: so,
        });
        if (q) params.set('search', q);

        const res = await fetch(`/api/admin/users?${params.toString()}`);
        if (!res.ok) throw new Error('Ошибка запроса');

        const data = await res.json();
        setUsers(data.users);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch {
        setError('Не удалось загрузить данные. Попробуйте обновить страницу.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleSearchChange = (value: string): void => {
    setInputQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActiveQuery(value);
      setPage(1);
      doFetch(1, value, status, sort);
    }, 300);
  };

  const handleStatusChange = (newStatus: UserStatusFilter): void => {
    setStatus(newStatus);
    setPage(1);
    doFetch(1, activeQuery, newStatus, sort);
  };

  const handleSortChange = (newSort: UserSortValue): void => {
    setSort(newSort);
    setPage(1);
    doFetch(1, activeQuery, status, newSort);
  };

  const handlePageChange = (newPage: number): void => {
    setPage(newPage);
    doFetch(newPage, activeQuery, status, sort);
  };

  const handleBanSuccess = (userId: string, updatedIsBlocked: boolean): void => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isBlocked: updatedIsBlocked } : u)),
    );
  };

  const handleDeleteSuccess = (userId: string): void => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setTotal((prev) => prev - 1);
  };

  const pageNumbers = buildPageNumbers(page, totalPages);
  const hasActiveFilters = status !== 'all' || sort !== 'createdAt_desc';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-admin-accent">
          Управление пользователями
        </h1>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Ключ или пользователь"
              value={inputQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-64 pl-4 pr-9 py-2 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border border-transparent focus:outline-none focus:border-admin-accent placeholder:text-admin-placeholder transition-colors"
            />
            <Search
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-placeholder"
            />
          </div>

          <button
            onClick={() => setShowExport(true)}
            className="px-4 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors"
          >
            Выгрузить
          </button>
        </div>
      </div>

      <button
        onClick={() => setShowFilters((v) => !v)}
        className={[
          'flex items-center gap-2 text-sm mb-3 px-3 py-1.5 rounded-lg transition-colors',
          hasActiveFilters || showFilters
            ? 'text-admin-accent bg-admin-accent-muted'
            : 'text-admin-label hover:bg-gray-100',
        ].join(' ')}
      >
        Фильтры
        {hasActiveFilters && (
          <span className="w-1.5 h-1.5 rounded-full bg-admin-accent" />
        )}
        {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showFilters && (
        <UsersFiltersPanel
          status={status}
          sort={sort}
          onStatusChange={handleStatusChange}
          onSortChange={handleSortChange}
        />
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-card-border">
              <th className="text-left px-4 py-3 text-sm font-medium text-admin-input-text">
                Email
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-admin-input-text">
                Логин
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-admin-input-text">
                Ключ
              </th>
              <th
                className="text-left px-4 py-3 text-sm font-medium text-admin-input-text cursor-pointer select-none"
                onClick={() => setShowFilters(true)}
              >
                <span className="flex items-center gap-1">
                  Статус
                  <ChevronDown size={13} className="text-admin-input-text" />
                </span>
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-admin-input-text">
                Прогресс
              </th>
              <th
                className="text-left px-4 py-3 text-sm font-medium text-admin-input-text cursor-pointer select-none"
                onClick={() => setShowFilters(true)}
              >
                <span className="flex items-center gap-1">
                  Дата регистрации
                  <ChevronDown size={13} className="text-admin-input-text" />
                </span>
              </th>
              <th className="px-4 py-3 w-36" />
            </tr>
          </thead>

          <tbody>
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-sm text-admin-placeholder">
                  Загрузка...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-sm text-admin-placeholder">
                  Пользователи не найдены
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className={[
                    'border-b border-admin-card-border last:border-b-0 hover:bg-gray-50/50 transition-colors',
                    loading ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  <td className="px-4 py-3">
                    <span className="inline-block bg-admin-input-text text-white text-xs px-3 py-1 rounded">
                      {user.email}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-sm text-admin-label">
                    {user.name || '—'}
                  </td>

                  <td className="px-4 py-3">
                    {user.accessKey ? (
                      <span className="inline-block bg-admin-input-text text-white text-xs px-3 py-1 rounded font-mono">
                        {user.accessKey.key}
                      </span>
                    ) : (
                      <span className="text-sm text-admin-placeholder">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-sm text-admin-label">
                    {user.isBlocked ? (
                      <span className="text-gray-400">Заблокирован</span>
                    ) : (
                      <span className="text-emerald-600">Активный</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-sm text-admin-label">
                    —
                  </td>

                  <td className="px-4 py-3 text-sm text-admin-label">
                    {formatDate(user.createdAt)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs text-white bg-admin-input-text hover:bg-gray-800 transition-colors"
                      >
                        Состояние
                      </Link>
                      <button
                        onClick={() =>
                          setBanDialog({
                            userId: user.id,
                            userEmail: user.email,
                            currentIsBlocked: user.isBlocked,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg text-xs text-admin-label border border-admin-card-border hover:bg-gray-50 transition-colors"
                      >
                        {user.isBlocked ? 'Разблокировать' : 'Блокировать'}
                      </button>
                      <button
                        onClick={() =>
                          setDeleteDialog({ userId: user.id, userEmail: user.email })
                        }
                        className="px-3 py-1.5 rounded-lg text-xs text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center mt-4 gap-1">
          {pageNumbers.map((p, i) =>
            p === '...' ? (
              <span
                key={`dots-${i}`}
                className="w-8 h-8 flex items-center justify-center text-sm text-admin-placeholder"
              >
                •••
              </span>
            ) : (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={[
                  'w-8 h-8 rounded-lg text-sm transition-colors',
                  p === page
                    ? 'bg-admin-accent text-white'
                    : 'text-admin-label hover:bg-gray-100',
                ].join(' ')}
              >
                {p}
              </button>
            ),
          )}
        </div>
      )}

      {showExport && <ExportEmailsModal onClose={() => setShowExport(false)} />}

      {banDialog && (
        <BanUserDialog
          userId={banDialog.userId}
          userEmail={banDialog.userEmail}
          currentIsBlocked={banDialog.currentIsBlocked}
          onSuccess={(updatedIsBlocked) =>
            handleBanSuccess(banDialog.userId, updatedIsBlocked)
          }
          onClose={() => setBanDialog(null)}
        />
      )}

      {deleteDialog && (
        <DeleteUserDialog
          userId={deleteDialog.userId}
          userEmail={deleteDialog.userEmail}
          onSuccess={() => handleDeleteSuccess(deleteDialog.userId)}
          onClose={() => setDeleteDialog(null)}
        />
      )}
    </div>
  );
}
