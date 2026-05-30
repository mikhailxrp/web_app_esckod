'use client';

import { useCallback, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AuditLogItem } from '@/types/admin-audit-log';
import type { AuditLogQuery } from '@/lib/validations/admin-audit-log';
import { AuditLogFilters } from './AuditLogFilters';

interface AuditLogTableProps {
  initialLogs: AuditLogItem[];
  initialNextCursor: string | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function InitiatorCell({ item }: { item: AuditLogItem }): React.ReactElement {
  if (item.adminId) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-admin-placeholder">Админ</span>
        <span className="text-sm text-admin-input-text">{item.adminEmail}</span>
      </div>
    );
  }
  if (item.userId) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-admin-placeholder">Игрок</span>
        <span className="text-sm text-admin-input-text">{item.userEmail}</span>
      </div>
    );
  }
  return <span className="text-sm text-admin-placeholder">—</span>;
}

function MetadataCell({ metadata }: { metadata: AuditLogItem['metadata'] }): React.ReactElement {
  const [open, setOpen] = useState(false);

  if (metadata === null || metadata === undefined) {
    return <span className="text-sm text-admin-placeholder">—</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-admin-accent hover:underline"
      >
        {open ? 'Скрыть' : 'Показать'}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <pre className="mt-2 p-2 rounded-lg bg-gray-50 border border-admin-card-border text-xs text-admin-input-text overflow-x-auto max-w-xs whitespace-pre-wrap break-all">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AuditLogTable({
  initialLogs,
  initialNextCursor,
}: AuditLogTableProps): React.ReactElement {
  const [logs, setLogs] = useState<AuditLogItem[]>(initialLogs);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [filters, setFilters] = useState<Partial<AuditLogQuery>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const buildParams = useCallback(
    (extra: Partial<AuditLogQuery> & { cursor?: string }): string => {
      const params = new URLSearchParams();
      const merged = { ...filters, ...extra };

      if (merged.type) params.set('type', merged.type);
      if (merged.userId) params.set('userId', merged.userId);
      if (merged.adminId) params.set('adminId', merged.adminId);
      if (merged.fromDate) params.set('fromDate', merged.fromDate);
      if (merged.toDate) params.set('toDate', merged.toDate);
      if (merged.cursor) params.set('cursor', merged.cursor);

      return params.toString();
    },
    [filters],
  );

  const handleFilter = useCallback(async (params: Partial<AuditLogQuery>): Promise<void> => {
    setFilters(params);
    setIsLoading(true);
    setError(null);
    setExpandedId(null);

    try {
      const qs = new URLSearchParams();
      if (params.type) qs.set('type', params.type);
      if (params.userId) qs.set('userId', params.userId);
      if (params.adminId) qs.set('adminId', params.adminId);
      if (params.fromDate) qs.set('fromDate', params.fromDate);
      if (params.toDate) qs.set('toDate', params.toDate);

      const res = await fetch(`/api/admin/audit-log?${qs.toString()}`);
      if (!res.ok) throw new Error('Ошибка запроса');

      const data: { logs: AuditLogItem[]; nextCursor: string | null } = await res.json();
      setLogs(data.logs);
      setNextCursor(data.nextCursor);
    } catch {
      setError('Не удалось загрузить данные. Попробуйте ещё раз.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLoadMore = async (): Promise<void> => {
    if (!nextCursor || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const qs = buildParams({ cursor: nextCursor });
      const res = await fetch(`/api/admin/audit-log?${qs}`);
      if (!res.ok) throw new Error('Ошибка запроса');

      const data: { logs: AuditLogItem[]; nextCursor: string | null } = await res.json();
      setLogs((prev) => [...prev, ...data.logs]);
      setNextCursor(data.nextCursor);
    } catch {
      setError('Не удалось загрузить данные. Попробуйте ещё раз.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRow = (id: string): void => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-admin-accent mb-6">Аудит-лог</h1>

      <AuditLogFilters onFilter={handleFilter} />

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-card-border">
              <th className="text-left px-4 py-3 text-sm font-medium text-admin-input-text whitespace-nowrap">
                Дата и время
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-admin-input-text">
                Тип
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-admin-input-text">
                Инициатор
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-admin-input-text">
                Сообщение
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-admin-input-text">
                Метаданные
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading && logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-sm text-admin-placeholder">
                  Загрузка...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-sm text-admin-placeholder">
                  Записей не найдено
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedId === log.id;
                return (
                  <tr
                    key={log.id}
                    onClick={() => toggleRow(log.id)}
                    className={[
                      'border-b border-admin-card-border last:border-b-0 cursor-pointer transition-colors',
                      isExpanded ? 'bg-gray-50/80' : 'hover:bg-gray-50/50',
                      isLoading ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 text-sm text-admin-label whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block font-mono text-xs bg-admin-input-bg text-admin-input-text px-2 py-0.5 rounded">
                        {log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <InitiatorCell item={log} />
                    </td>
                    <td className="px-4 py-3 text-sm text-admin-label max-w-xs">
                      {isExpanded ? (
                        <span>{log.message}</span>
                      ) : (
                        <span className="line-clamp-2">{log.message}</span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MetadataCell metadata={log.metadata} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoading}
            className="px-6 py-2 rounded-lg text-sm text-admin-label border border-admin-card-border hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Загрузка...' : 'Загрузить ещё'}
          </button>
        </div>
      )}
    </div>
  );
}
