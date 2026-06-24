'use client';

import type { ActivationsFilterValue, SortValue, StatusFilter } from '@/types/admin-keys';

const ACTIVATIONS_OPTIONS: { value: ActivationsFilterValue; label: string }[] = [
  { value: 'eq0', label: '0 активаций' },
  { value: 'eq1', label: '1 активация' },
  { value: 'eq2', label: '2 активации' },
  { value: 'eq3', label: '3 активации' },
  { value: 'eq4', label: '4 активации' },
  { value: 'eq5', label: '5 активаций' },
  { value: 'gt5', label: 'Более 5' },
];

interface KeysFiltersPanelProps {
  sort: SortValue;
  status: StatusFilter;
  activations: ActivationsFilterValue[];
  limitChanged: boolean;
  onSortChange: (sort: SortValue) => void;
  onStatusChange: (status: StatusFilter) => void;
  onActivationsChange: (activations: ActivationsFilterValue[]) => void;
  onLimitChangedChange: (limitChanged: boolean) => void;
}

export function KeysFiltersPanel({
  sort,
  status,
  activations,
  limitChanged,
  onSortChange,
  onStatusChange,
  onActivationsChange,
  onLimitChangedChange,
}: KeysFiltersPanelProps): React.ReactElement {
  const handleActivationToggle = (value: ActivationsFilterValue): void => {
    if (activations.includes(value)) {
      onActivationsChange(activations.filter((v) => v !== value));
    } else {
      onActivationsChange([...activations, value]);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-4 mb-4">
      <h3 className="text-sm font-semibold text-admin-accent mb-3">Фильтрация</h3>
      <div className="grid grid-cols-4 gap-6">
        <fieldset>
          <legend className="text-xs font-medium text-admin-input-text mb-2">
            Дата создания
          </legend>

          {(
            [
              ['createdAt_desc', 'Более поздние'],
              ['createdAt_asc', 'Более ранние'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-2 text-sm text-admin-label cursor-pointer mb-2 last:mb-0"
            >
              <input
                type="radio"
                name="sort"
                checked={sort === value}
                onChange={() => onSortChange(value)}
                className="accent-admin-accent"
              />
              {label}
            </label>
          ))}

          <p className="text-xs font-medium text-admin-input-text mt-3 mb-2">
            Количество активаций
          </p>

          {(
            [
              ['activations_desc', 'От большего'],
              ['activations_asc', 'От меньшего'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-2 text-sm text-admin-label cursor-pointer mb-2 last:mb-0"
            >
              <input
                type="radio"
                name="sort"
                checked={sort === value}
                onChange={() => onSortChange(value)}
                className="accent-admin-accent"
              />
              {label}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium text-admin-input-text mb-2">Статус</legend>

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

          {ACTIVATIONS_OPTIONS.map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-2 text-sm text-admin-label cursor-pointer mb-2 last:mb-0"
            >
              <input
                type="checkbox"
                checked={activations.includes(value)}
                onChange={() => handleActivationToggle(value)}
                className="accent-admin-accent"
              />
              {label}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium text-admin-input-text mb-2">
            Лимит активаций
          </legend>

          <label className="flex items-center gap-2 text-sm text-admin-label cursor-pointer">
            <input
              type="checkbox"
              checked={limitChanged}
              onChange={(e) => onLimitChangedChange(e.target.checked)}
              className="accent-admin-accent"
            />
            Изменен лимит
          </label>
        </fieldset>
      </div>
    </div>
  );
}
