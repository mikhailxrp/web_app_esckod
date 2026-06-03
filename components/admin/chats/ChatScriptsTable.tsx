'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Music, Filter } from 'lucide-react';
import type { ChatAuthor, ChatScriptListItem, ChatType } from '@/types/admin-chats';
import { ChatScriptForm } from './ChatScriptForm';
import { DeleteScriptDialog } from './DeleteScriptDialog';

interface ChatScriptsTableProps {
  scripts: ChatScriptListItem[];
  onScriptsMutated: () => void;
}

const CHAT_TYPE_LABELS: Record<ChatType, string> = {
  DETECTIVE: 'Детектив',
  MARINA: 'Марина',
};

const CHAT_AUTHOR_LABELS: Record<ChatAuthor, string> = {
  DETECTIVE: 'Детектив',
  PLAYER: 'Игрок',
  MARINA: 'Марина',
  ANONYMOUS: 'Аноним',
};

const CHAT_AUTHOR_COLORS: Record<ChatAuthor, string> = {
  DETECTIVE: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  PLAYER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  MARINA: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  ANONYMOUS: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
};

type FilterValue = 'ALL' | ChatType;

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'DETECTIVE', label: 'Детектив' },
  { value: 'MARINA', label: 'Марина' },
];

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function ChatScriptsTable({
  scripts,
  onScriptsMutated,
}: ChatScriptsTableProps): React.ReactElement {
  const [filter, setFilter] = useState<FilterValue>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ChatScriptListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatScriptListItem | null>(null);

  const filtered =
    filter === 'ALL' ? scripts : scripts.filter((s) => s.chatType === filter);

  return (
    <>
      <div className="rounded-xl border border-admin-card-border bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-admin-card-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" aria-hidden="true" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Фильтр:</span>
            <div className="flex gap-1">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    filter === opt.value
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                      : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={14} aria-hidden="true" />
            Создать реплику
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-card-border bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Код
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Автор
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Текст
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  Старт
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  Конец
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  Выбор
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  Аудио
                </th>
                <th className="px-4 py-3" aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500"
                  >
                    Реплики не найдены
                  </td>
                </tr>
              ) : (
                filtered.map((script) => (
                  <ScriptRow
                    key={script.id}
                    script={script}
                    onEdit={() => setEditTarget(script)}
                    onDelete={() => setDeleteTarget(script)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="border-t border-admin-card-border px-4 py-2 text-xs text-gray-400 dark:text-gray-500">
            Всего: {filtered.length}
          </div>
        )}
      </div>

      {createOpen && (
        <ChatScriptForm
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            onScriptsMutated();
          }}
        />
      )}

      {editTarget && (
        <ChatScriptForm
          mode="edit"
          script={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            onScriptsMutated();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteScriptDialog
          scriptId={deleteTarget.id}
          scriptCode={deleteTarget.code}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            onScriptsMutated();
          }}
        />
      )}
    </>
  );
}

interface ScriptRowProps {
  script: ChatScriptListItem;
  onEdit: () => void;
  onDelete: () => void;
}

function ScriptRow({ script, onEdit, onDelete }: ScriptRowProps): React.ReactElement {
  return (
    <tr className="border-b border-admin-card-border last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/40">
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{script.code}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span
            className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${CHAT_AUTHOR_COLORS[script.author]}`}
          >
            {CHAT_AUTHOR_LABELS[script.author]}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {CHAT_TYPE_LABELS[script.chatType]}
          </span>
        </div>
      </td>
      <td className="max-w-xs px-4 py-3 text-gray-600 dark:text-gray-300">
        {truncate(script.text)}
      </td>
      <td className="px-4 py-3 text-center">
        <BoolBadge value={script.isStart} />
      </td>
      <td className="px-4 py-3 text-center">
        <BoolBadge value={script.isEnd} />
      </td>
      <td className="px-4 py-3 text-center">
        <BoolBadge value={script.hasChoices} />
      </td>
      <td className="px-4 py-3 text-center">
        {script.audioUrl ? (
          <Music size={14} className="mx-auto text-green-500" aria-label="Есть аудио" />
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label={`Редактировать ${script.code}`}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            aria-label={`Удалить ${script.code}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function BoolBadge({ value }: { value: boolean }): React.ReactElement {
  return value ? (
    <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
      Да
    </span>
  ) : (
    <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
  );
}
