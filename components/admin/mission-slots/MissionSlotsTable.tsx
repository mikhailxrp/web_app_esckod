'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { MissionType } from '@prisma/client';
import type { MissionSlotListItem } from '@/types/admin-mission-slots';
import { ToggleActiveControl } from './ToggleActiveControl';
import { DeleteSlotDialog } from './DeleteSlotDialog';

interface MissionSlotsTableProps {
  initialSlots: MissionSlotListItem[];
}

type FilterType = MissionType | 'ALL';
type FilterActive = 'true' | 'false' | 'ALL';

const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  CRACK: 'Взлом сайта',
  DECIPHER: 'Дешифратор',
  RDP: 'Удалённый доступ',
};

const MISSION_TYPE_BADGE: Record<MissionType, string> = {
  CRACK: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  DECIPHER: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  RDP: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
};

export function MissionSlotsTable({ initialSlots }: MissionSlotsTableProps): React.ReactElement {
  const [slots, setSlots] = useState<MissionSlotListItem[]>(initialSlots);
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [filterActive, setFilterActive] = useState<FilterActive>('ALL');
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MissionSlotListItem | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/admin/mission-slots');

      if (!response.ok) {
        setFetchError('Не удалось обновить список слотов');
        return;
      }

      const data = (await response.json()) as MissionSlotListItem[];
      setSlots(data);
      setFetchError(null);
    } catch {
      setFetchError('Не удалось выполнить запрос');
    }
  }, []);

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (filterType !== 'ALL' && slot.missionType !== filterType) return false;
      if (filterActive === 'true' && !slot.isActive) return false;
      if (filterActive === 'false' && slot.isActive) return false;
      return true;
    });
  }, [slots, filterType, filterActive]);

  return (
    <>
      <div className="rounded-xl border border-admin-card-border bg-white dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-card-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="filter-type"
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                Тип:
              </label>
              <select
                id="filter-type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="ALL">Все</option>
                <option value="CRACK">Взлом сайта</option>
                <option value="DECIPHER">Дешифратор</option>
                <option value="RDP">Удалённый доступ</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="filter-active"
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                Статус:
              </label>
              <select
                id="filter-active"
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value as FilterActive)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="ALL">Все</option>
                <option value="true">Активен</option>
                <option value="false">Отключён</option>
              </select>
            </div>
          </div>

          <Link
            href="/admin/mission-slots/new"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={14} aria-hidden="true" />
            Создать слот
          </Link>
        </div>

        {fetchError && (
          <div className="border-b border-admin-card-border px-4 py-3">
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {fetchError}
            </p>
          </div>
        )}

        {actionError && (
          <div className="border-b border-admin-card-border px-4 py-3">
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {actionError}
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-card-border bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  slotKey
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Наименование
                </th>
                <th className="w-20 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  Порядок
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Тип миссии
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Статус
                </th>
                <th className="w-28 px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  Прохождений
                </th>
                <th className="w-32 px-4 py-3" aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {filteredSlots.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500"
                  >
                    Слоты не найдены.
                  </td>
                </tr>
              ) : (
                filteredSlots.map((slot) => (
                  <SlotRow
                    key={slot.id}
                    slot={slot}
                    onDelete={() => setDeleteTarget(slot)}
                    onToggled={() => {
                      setActionError(null);
                      void refetch();
                    }}
                    onError={(msg) => setActionError(msg)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredSlots.length > 0 && (
          <div className="border-t border-admin-card-border px-4 py-2 text-xs text-gray-400 dark:text-gray-500">
            Показано: {filteredSlots.length} / Всего: {slots.length}
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteSlotDialog
          slot={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            void refetch();
          }}
        />
      )}
    </>
  );
}

interface SlotRowProps {
  slot: MissionSlotListItem;
  onDelete: () => void;
  onToggled: () => void;
  onError: (message: string) => void;
}

function SlotRow({ slot, onDelete, onToggled, onError }: SlotRowProps): React.ReactElement {
  return (
    <tr className="border-b border-admin-card-border last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/40">
      <td className="px-4 py-3">
        <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-300">
          {slot.slotKey}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
        {slot.displayName}
      </td>
      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
        {slot.orderIndex}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${MISSION_TYPE_BADGE[slot.missionType]}`}
        >
          {MISSION_TYPE_LABELS[slot.missionType]}
        </span>
      </td>
      <td className="px-4 py-3">
        <ToggleActiveControl slot={slot} onToggled={onToggled} onError={onError} />
      </td>
      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
        {slot.completionsCount}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/admin/mission-slots/${slot.id}`}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label={`Редактировать слот ${slot.slotKey}`}
          >
            <Pencil size={14} />
          </Link>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            aria-label={`Удалить слот ${slot.slotKey}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
