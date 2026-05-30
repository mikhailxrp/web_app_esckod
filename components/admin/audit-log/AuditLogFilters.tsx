'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import type { AuditLogQuery } from '@/lib/validations/admin-audit-log';

interface AuditLogFiltersProps {
  onFilter: (params: Partial<AuditLogQuery>) => void;
}

interface FilterState {
  type: string;
  userId: string;
  adminId: string;
  fromDate: string;
  toDate: string;
}

const EMPTY: FilterState = {
  type: '',
  userId: '',
  adminId: '',
  fromDate: '',
  toDate: '',
};

function toISODate(dateStr: string): string {
  return new Date(dateStr).toISOString();
}

function hasActiveFilters(f: FilterState): boolean {
  return Object.values(f).some((v) => v !== '');
}

export function AuditLogFilters({ onFilter }: AuditLogFiltersProps): React.ReactElement {
  const [fields, setFields] = useState<FilterState>(EMPTY);
  const [isOpen, setIsOpen] = useState(false);

  const set = (key: keyof FilterState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleApply = (): void => {
    const params: Partial<AuditLogQuery> = {};
    if (fields.type) params.type = fields.type;
    if (fields.userId) params.userId = fields.userId;
    if (fields.adminId) params.adminId = fields.adminId;
    if (fields.fromDate) params.fromDate = toISODate(fields.fromDate);
    if (fields.toDate) params.toDate = toISODate(fields.toDate + 'T23:59:59');
    onFilter(params);
  };

  const handleReset = (): void => {
    setFields(EMPTY);
    onFilter({});
  };

  const active = hasActiveFilters(fields);

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={[
          'flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors',
          active || isOpen
            ? 'text-admin-accent bg-admin-accent-muted'
            : 'text-admin-label hover:bg-gray-100',
        ].join(' ')}
      >
        <SlidersHorizontal size={14} />
        Фильтры
        {active && <span className="w-1.5 h-1.5 rounded-full bg-admin-accent" />}
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleApply();
          }}
          className="mt-3 p-4 bg-white rounded-xl border border-admin-card-border shadow-admin-card grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs text-admin-label font-medium">Тип события</label>
            <input
              type="text"
              placeholder="user_restart, ..."
              value={fields.type}
              onChange={set('type')}
              className="w-full px-3 py-2 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border border-transparent focus:outline-none focus:border-admin-accent placeholder:text-admin-placeholder transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-admin-label font-medium">User ID</label>
            <input
              type="text"
              placeholder="cuid..."
              value={fields.userId}
              onChange={set('userId')}
              className="w-full px-3 py-2 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border border-transparent focus:outline-none focus:border-admin-accent placeholder:text-admin-placeholder transition-colors font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-admin-label font-medium">Admin ID</label>
            <input
              type="text"
              placeholder="cuid..."
              value={fields.adminId}
              onChange={set('adminId')}
              className="w-full px-3 py-2 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border border-transparent focus:outline-none focus:border-admin-accent placeholder:text-admin-placeholder transition-colors font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-admin-label font-medium">С даты</label>
            <input
              type="date"
              value={fields.fromDate}
              onChange={set('fromDate')}
              className="w-full px-3 py-2 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border border-transparent focus:outline-none focus:border-admin-accent transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-admin-label font-medium">По дату</label>
            <input
              type="date"
              value={fields.toDate}
              onChange={set('toDate')}
              className="w-full px-3 py-2 rounded-lg bg-admin-input-bg text-admin-input-text text-sm border border-transparent focus:outline-none focus:border-admin-accent transition-colors"
            />
          </div>

          <div className="col-span-full flex items-center gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors"
            >
              Применить
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-sm text-admin-label border border-admin-card-border hover:bg-gray-50 transition-colors"
            >
              Сбросить
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
