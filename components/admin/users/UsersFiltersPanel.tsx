'use client';

import { ChevronDown } from 'lucide-react';
import type { UserCompletionsFilter, UserSortValue, UserStatusFilter } from '@/types/admin-users';

interface UsersFiltersPanelProps {
  status: UserStatusFilter;
  sort: UserSortValue;
  completions: UserCompletionsFilter;
  onStatusChange: (status: UserStatusFilter) => void;
  onSortChange: (sort: UserSortValue) => void;
  onCompletionsChange: (completions: UserCompletionsFilter) => void;
}

const STATUS_OPTIONS: { value: UserStatusFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'blocked', label: 'Деактивированные' },
  { value: 'active', label: 'Активные' },
];

const SORT_OPTIONS: { value: UserSortValue; label: string }[] = [
  { value: 'createdAt_asc', label: 'Более ранние' },
  { value: 'createdAt_desc', label: 'Более поздние' },
];

const COMPLETIONS_OPTIONS: { value: UserCompletionsFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: '0', label: 'Нет прохождений' },
  { value: '1plus', label: '1 и более' },
  { value: '5plus', label: '5 и более' },
];

export function UsersFiltersPanel({
  status,
  sort,
  completions,
  onStatusChange,
  onSortChange,
  onCompletionsChange,
}: UsersFiltersPanelProps): React.ReactElement {
  return (
    <div className="mb-4">
      <p className="text-xs text-admin-placeholder mb-2">Фильтрация</p>
      <div className="flex gap-4">
        <div className="bg-white rounded-xl border border-admin-card-border shadow-admin-card p-4 min-w-[180px]">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-sm font-medium text-admin-input-text">Статус</span>
            <ChevronDown size={13} className="text-admin-input-text" />
          </div>
          <div className="space-y-2">
            {STATUS_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-admin-label cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={status === value}
                  onChange={() => onStatusChange(value)}
                  className="accent-admin-accent w-4 h-4 cursor-pointer"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-admin-card-border shadow-admin-card p-4 min-w-[180px]">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-sm font-medium text-admin-input-text">Дата регистрации</span>
            <ChevronDown size={13} className="text-admin-input-text" />
          </div>
          <div className="space-y-2">
            {SORT_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-admin-label cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={sort === value}
                  onChange={() => onSortChange(value)}
                  className="accent-admin-accent w-4 h-4 cursor-pointer"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-admin-card-border shadow-admin-card p-4 min-w-[180px]">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-sm font-medium text-admin-input-text">Прохождений</span>
            <ChevronDown size={13} className="text-admin-input-text" />
          </div>
          <div className="space-y-2">
            {COMPLETIONS_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-admin-label cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={completions === value}
                  onChange={() => onCompletionsChange(value)}
                  className="accent-admin-accent w-4 h-4 cursor-pointer"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
