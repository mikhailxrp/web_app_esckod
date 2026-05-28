'use client';

import { Fragment, useCallback, useRef, useState } from 'react';
import { Search, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import type {
  AccessKeyDetail,
  AccessKeyListItem,
  ActivationsFilterValue,
  SortValue,
  StatusFilter,
} from '@/types/admin-keys';
import { ExportKeysModal } from './ExportKeysModal';
import { KeyRowDetails } from './KeyRowDetails';
import { KeysFiltersPanel } from './KeysFiltersPanel';

const LIMIT = 14;

interface KeysTableProps {
  initialData: AccessKeyListItem[];
  initialTotal: number;
  initialTotalPages: number;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

function pluralUsers(count: number): string {
  if (count === 1) return '1 пользователь';
  if (count >= 2 && count <= 4) return `${count} пользователя`;
  return `${count} пользователей`;
}

function buildPageNumbers(
  current: number,
  total: number,
): (number | '...')[] {
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

export function KeysTable({
  initialData,
  initialTotal,
  initialTotalPages,
}: KeysTableProps): React.ReactElement {
  const [keys, setKeys] = useState<AccessKeyListItem[]>(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [page, setPage] = useState(1);

  const [inputQuery, setInputQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [sort, setSort] = useState<SortValue>('createdAt_desc');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [activations, setActivations] = useState<ActivationsFilterValue[]>([]);
  const [limitChanged, setLimitChanged] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, AccessKeyDetail>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doFetch = useCallback(
    async (
      p: number,
      q: string,
      s: SortValue,
      st: StatusFilter,
      ac: ActivationsFilterValue[],
      lc: boolean,
    ): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(LIMIT),
          sort: s,
          status: st,
        });
        if (q) params.set('q', q);
        ac.forEach((v) => params.append('activations', v));
        if (lc) params.set('limitChanged', 'true');

        const res = await fetch(`/api/admin/keys?${params.toString()}`);
        if (!res.ok) throw new Error('Ошибка запроса');

        const data = await res.json();
        setKeys(data.keys);
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
      doFetch(1, value, sort, status, activations, limitChanged);
    }, 300);
  };

  const handleSortChange = (newSort: SortValue): void => {
    setSort(newSort);
    setPage(1);
    doFetch(1, activeQuery, newSort, status, activations, limitChanged);
  };

  const handleStatusChange = (newStatus: StatusFilter): void => {
    setStatus(newStatus);
    setPage(1);
    doFetch(1, activeQuery, sort, newStatus, activations, limitChanged);
  };

  const handleActivationsChange = (newActivations: ActivationsFilterValue[]): void => {
    setActivations(newActivations);
    setPage(1);
    doFetch(1, activeQuery, sort, status, newActivations, limitChanged);
  };

  const handleLimitChangedChange = (newLimitChanged: boolean): void => {
    setLimitChanged(newLimitChanged);
    setPage(1);
    doFetch(1, activeQuery, sort, status, activations, newLimitChanged);
  };

  const handlePageChange = (newPage: number): void => {
    setPage(newPage);
    setExpandedId(null);
    doFetch(newPage, activeQuery, sort, status, activations, limitChanged);
  };

  const fetchDetail = async (id: string): Promise<void> => {
    if (detailsCache[id]) {
      setExpandedId(id);
      return;
    }

    setExpandedId(id);
    setLoadingDetailId(id);
    try {
      const res = await fetch(`/api/admin/keys/${id}`);
      if (!res.ok) throw new Error('Not found');
      const data: AccessKeyDetail = await res.json();
      setDetailsCache((prev) => ({ ...prev, [id]: data }));
    } catch {
      setExpandedId(null);
    } finally {
      setLoadingDetailId(null);
    }
  };

  const handleToggleRow = (id: string): void => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      fetchDetail(id);
    }
  };

  const updateKeyInList = (id: string, patch: Partial<AccessKeyListItem>): void => {
    setKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, ...patch } : k)),
    );
  };

  const updateDetailCache = (id: string, patch: Partial<AccessKeyDetail>): void => {
    setDetailsCache((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, ...patch } };
    });
  };

  const handleSaveLimit = async (
    id: string,
    maxActivations: number,
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await fetch(`/api/admin/keys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxActivations }),
    });
    if (!res.ok) {
      const data = await res.json();
      const error =
        data.error === 'MAX_BELOW_CURRENT'
          ? 'Лимит не может быть меньше текущего числа активаций'
          : 'Не удалось сохранить. Попробуйте ещё раз';
      return { success: false, error };
    }
    const updated = await res.json();
    updateKeyInList(id, { maxActivations: updated.maxActivations });
    updateDetailCache(id, { maxActivations: updated.maxActivations });
    return { success: true };
  };

  const handleBlock = async (id: string, reason: string): Promise<void> => {
    const res = await fetch(`/api/admin/keys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isBlocked: true, blockReason: reason }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    updateKeyInList(id, {
      isBlocked: true,
      blockedAt: updated.blockedAt,
    });
    updateDetailCache(id, {
      isBlocked: true,
      blockedAt: updated.blockedAt,
      blockReason: updated.blockReason,
    });
  };

  const handleActivate = async (id: string): Promise<void> => {
    const res = await fetch(`/api/admin/keys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isBlocked: false }),
    });
    if (!res.ok) return;
    updateKeyInList(id, { isBlocked: false, blockedAt: null });
    updateDetailCache(id, { isBlocked: false, blockedAt: null, blockReason: null });
  };

  const handleDelete = async (id: string): Promise<void> => {
    const res = await fetch(`/api/admin/keys/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      if (data.error === 'HAS_USERS') {
        alert('Нельзя удалить ключ с зарегистрированными пользователями');
      }
      return;
    }
    setKeys((prev) => prev.filter((k) => k.id !== id));
    setTotal((prev) => prev - 1);
    if (expandedId === id) setExpandedId(null);
    setDetailsCache((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const pageNumbers = buildPageNumbers(page, totalPages);

  const hasActiveFilters =
    sort !== 'createdAt_desc' ||
    status !== 'all' ||
    activations.length > 0 ||
    limitChanged;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-admin-accent">
          Управление ключами доступа
        </h1>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-admin-placeholder"
            />
            <input
              type="text"
              placeholder="Поиск по почте или ключу"
              value={inputQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-64 pl-9 pr-3 py-2 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border border-transparent focus:outline-none focus:border-admin-accent placeholder:text-admin-placeholder transition-colors"
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
        <SlidersHorizontal size={14} />
        Фильтры
        {hasActiveFilters && (
          <span className="w-1.5 h-1.5 rounded-full bg-admin-accent" />
        )}
        {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showFilters && (
        <KeysFiltersPanel
          sort={sort}
          status={status}
          activations={activations}
          limitChanged={limitChanged}
          onSortChange={handleSortChange}
          onStatusChange={handleStatusChange}
          onActivationsChange={handleActivationsChange}
          onLimitChangedChange={handleLimitChangedChange}
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
              <th className="text-left px-4 py-3 text-sm font-medium text-admin-input-text w-1/3">
                Ключ
              </th>
              <th
                className="text-left px-4 py-3 text-sm font-medium text-admin-input-text cursor-pointer select-none group"
                onClick={() =>
                  handleSortChange(
                    sort === 'createdAt_desc' ? 'createdAt_asc' : 'createdAt_desc',
                  )
                }
              >
                <span className="flex items-center gap-1">
                  Дата создания
                  {sort === 'createdAt_desc' ? (
                    <ChevronDown size={13} className="text-admin-accent" />
                  ) : (
                    <ChevronUp size={13} className="text-admin-accent" />
                  )}
                </span>
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-admin-input-text">
                Статус
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-admin-input-text">
                Количество активаций
              </th>
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>

          <tbody>
            {loading && keys.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-10 text-sm text-admin-placeholder"
                >
                  Загрузка...
                </td>
              </tr>
            ) : keys.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-10 text-sm text-admin-placeholder"
                >
                  Ключи не найдены
                </td>
              </tr>
            ) : (
              keys.map((keyItem, index) => {
                const isExpanded = expandedId === keyItem.id;
                const detail = detailsCache[keyItem.id] ?? null;
                const isLoadingDetail = loadingDetailId === keyItem.id;
                const rowNumber = (page - 1) * LIMIT + index + 1;

                return (
                  <Fragment key={keyItem.id}>
                    <tr
                      className={[
                        'border-b border-admin-card-border last:border-b-0 transition-colors',
                        isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50/50',
                        loading ? 'opacity-60' : '',
                      ].join(' ')}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm text-admin-placeholder mr-1">
                          {rowNumber}.
                        </span>
                        <span className="font-mono text-sm text-admin-input-text">
                          {keyItem.key}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-sm text-admin-label">
                        {formatDate(keyItem.createdAt)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={
                            keyItem.isBlocked
                              ? 'text-sm text-gray-400'
                              : 'text-sm text-emerald-600'
                          }
                        >
                          {keyItem.isBlocked ? 'Деактивирован' : 'Активен'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-sm text-admin-label">
                        {pluralUsers(keyItem.currentActivations)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {!isExpanded && (
                          <button
                            onClick={() => handleToggleRow(keyItem.id)}
                            disabled={isLoadingDetail}
                            className="px-4 py-2 rounded-lg text-sm text-white bg-admin-input-text hover:bg-gray-800 transition-colors disabled:opacity-50"
                          >
                            {isLoadingDetail ? 'Загрузка...' : 'Детали'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b border-admin-card-border bg-gray-50">
                        <KeyRowDetails
                          detail={detail}
                          onCollapse={() => setExpandedId(null)}
                          onSaveLimit={(maxActivations) =>
                            handleSaveLimit(keyItem.id, maxActivations)
                          }
                          onBlock={(reason) =>
                            handleBlock(keyItem.id, reason)
                          }
                          onActivate={() => handleActivate(keyItem.id)}
                          onDelete={() => handleDelete(keyItem.id)}
                        />
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-admin-placeholder">
            Всего: {total}
          </p>
          <div className="flex items-center gap-1">
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
        </div>
      )}

      {showExport && <ExportKeysModal onClose={() => setShowExport(false)} />}
    </div>
  );
}
