'use client';

import type { ActivationsFilter, SortValue, StatusFilter } from '@/types/admin-keys';

interface KeysFiltersPanelProps {
  sort: SortValue;
  status: StatusFilter;
  activations: ActivationsFilter;
  onSortChange: (sort: SortValue) => void;
  onStatusChange: (status: StatusFilter) => void;
  onActivationsChange: (activations: ActivationsFilter) => void;
}

export function KeysFiltersPanel({
  sort,
  status,
  activations,
  onSortChange,
  onStatusChange,
  onActivationsChange,
}: KeysFiltersPanelProps): React.ReactElement {
  return (
    <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-4 mb-4">
      <h3 className="text-sm font-semibold text-admin-accent mb-3">
        Фильтрация
      </h3>
      <div className="grid grid-cols-3 gap-6">
        <fieldset>
          <legend className="text-xs font-medium text-admin-input-text mb-2">
            Дата создания
          </legend>

          <label className="flex items-center gap-2 text-sm text-admin-label cursor-pointer mb-2">
            <input
              type="radio"
              name="sort"
              checked={sort === 'createdAt_desc'}
              onChange={() => onSortChange('createdAt_desc')}
              className="accent-admin-accent"
            />
            Более поздние
          </label>

          <label className="flex items-center gap-2 text-sm text-admin-label cursor-pointer">
            <input
              type="radio"
              name="sort"
              checked={sort === 'createdAt_asc'}
              onChange={() => onSortChange('createdAt_asc')}
              className="accent-admin-accent"
            />
            Более ранние
          </label>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium text-admin-input-text mb-2">
            Статус
          </legend>

          {(
            [
              ['all', 'Все'],
              ['blocked', 'Деактивированные'],
              ['active', 'Активные'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-2 text-sm text-admin-label cursor-pointer mb-2 last:mb-0"
            >
              <input
                type="radio"
                name="status"
                checked={status === value}
                onChange={() => onStatusChange(value)}
                className="accent-admin-accent"
              />
              {label}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium text-admin-input-text mb-2">
            Количество активаций
          </legend>

          {(
            [
              ['all', 'Все'],
              ['lt5', 'Менее 5 активаций'],
              ['eq5', '5 активаций'],
              ['gt5', 'Более 5 активаций'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-2 text-sm text-admin-label cursor-pointer mb-2 last:mb-0"
            >
              <input
                type="radio"
                name="activations"
                checked={activations === value}
                onChange={() => onActivationsChange(value)}
                className="accent-admin-accent"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
