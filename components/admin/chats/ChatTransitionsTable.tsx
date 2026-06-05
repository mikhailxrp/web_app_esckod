'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type {
  ChatScriptListItem,
  ChatTransitionListItem,
  ChatType,
  ConditionType,
  TriggerValueOption,
} from '@/types/admin-chats';
import { ChatTransitionForm } from './ChatTransitionForm';
import { DeleteTransitionDialog } from './DeleteTransitionDialog';

interface ChatTransitionsTableProps {
  transitions: ChatTransitionListItem[];
  scripts: ChatScriptListItem[];
  triggerValues: TriggerValueOption[];
  onTransitionsMutated: () => void;
}

const CHAT_TYPE_LABELS: Record<ChatType, string> = {
  DETECTIVE: 'Детектив',
  MARINA: 'Марина',
};

const CONDITION_COLORS: Record<ConditionType, string> = {
  ALWAYS: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  CHOICE: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  TRIGGER: 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200',
};

function transitionLabel(t: ChatTransitionListItem): string {
  const value = t.conditionValue ? ` / ${t.conditionValue}` : '';

  return `${t.from.code} → ${t.to.code} (${t.conditionType}${value})`;
}

export function ChatTransitionsTable({
  transitions,
  scripts,
  triggerValues,
  onTransitionsMutated,
}: ChatTransitionsTableProps): React.ReactElement {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ChatTransitionListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatTransitionListItem | null>(null);

  return (
    <>
      <div className="rounded-xl border border-admin-card-border bg-white dark:bg-gray-900">
        <div className="flex items-center justify-end border-b border-admin-card-border px-4 py-3">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={14} aria-hidden="true" />
            Создать переход
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-card-border bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Откуда
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Куда
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Условие
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Значение
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  Приоритет
                </th>
                <th className="px-4 py-3" aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {transitions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500"
                  >
                    Переходы не найдены
                  </td>
                </tr>
              ) : (
                transitions.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-admin-card-border last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  >
                    <td className="px-4 py-3">
                      <ScriptRef code={t.from.code} chatType={t.from.chatType} />
                    </td>
                    <td className="px-4 py-3">
                      <ScriptRef code={t.to.code} chatType={t.to.chatType} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${CONDITION_COLORS[t.conditionType]}`}
                      >
                        {t.conditionType}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {t.conditionValue ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">
                      {t.priority}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditTarget(t)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                          aria-label={`Редактировать переход ${transitionLabel(t)}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(t)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          aria-label={`Удалить переход ${transitionLabel(t)}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {transitions.length > 0 && (
          <div className="border-t border-admin-card-border px-4 py-2 text-xs text-gray-400 dark:text-gray-500">
            Всего: {transitions.length}
          </div>
        )}
      </div>

      {createOpen && (
        <ChatTransitionForm
          mode="create"
          scripts={scripts}
          triggerValues={triggerValues}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            onTransitionsMutated();
          }}
        />
      )}

      {editTarget && (
        <ChatTransitionForm
          mode="edit"
          transition={editTarget}
          scripts={scripts}
          triggerValues={triggerValues}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            onTransitionsMutated();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteTransitionDialog
          transitionId={deleteTarget.id}
          transitionLabel={transitionLabel(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            onTransitionsMutated();
          }}
        />
      )}
    </>
  );
}

function ScriptRef({ code, chatType }: { code: string; chatType: ChatType }): React.ReactElement {
  return (
    <div>
      <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{code}</span>
      <span className="mt-0.5 block text-xs text-gray-400 dark:text-gray-500">
        {CHAT_TYPE_LABELS[chatType]}
      </span>
    </div>
  );
}
