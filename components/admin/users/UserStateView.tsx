'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { UserStateSnapshot } from '@/types/admin-users';
import { formatDuration } from '@/lib/formatDuration';
import { BanUserDialog } from './BanUserDialog';

interface UserStateViewProps {
  snapshot: UserStateSnapshot;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU');
}

function calcProgress(
  missionProgress: UserStateSnapshot['missionProgress'],
  totalActiveSlots: number,
): { percent: number; completed: number; total: number } | null {
  if (totalActiveSlots === 0) return null;
  const completed = missionProgress.filter((m) => m.completed).length;
  return {
    percent: Math.round((completed / totalActiveSlots) * 100),
    completed,
    total: totalActiveSlots,
  };
}

function MissionStatusLabel({ completed, inProgress }: { completed: boolean; inProgress: boolean }): React.ReactElement {
  if (completed) {
    return <span className="text-sm text-admin-placeholder">Пройдено</span>;
  }
  if (inProgress) {
    return <span className="text-sm text-admin-accent font-medium">В процессе</span>;
  }
  return <span className="text-sm text-admin-placeholder">Не пройдено</span>;
}

export function UserStateView({ snapshot }: UserStateViewProps): React.ReactElement {
  const router = useRouter();
  const [isBlocked, setIsBlocked] = useState(snapshot.user.isBlocked);
  const [showBanDialog, setShowBanDialog] = useState(false);

  const progress = calcProgress(snapshot.missionProgress, snapshot.totalActiveSlots);

  const missionList = snapshot.missionProgress;
  const currentMissionIndex = missionList.findIndex((m) => !m.completed);

  return (
    <div>
      <h1 className="text-xl font-semibold text-admin-accent mb-6">
        Управление пользователями
      </h1>

      {/* Общая информация */}
      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-admin-input-text">
            Общая информация
          </h2>
          <button
            onClick={() => router.back()}
            className="text-admin-placeholder hover:text-admin-input-text transition-colors"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-y-3 max-w-xl mx-auto">
          <InfoRow label="Логин :" value={snapshot.user.name || '—'} />
          <InfoRow label="Email :" value={snapshot.user.email} />
          <InfoRow
            label="Ключ :"
            value={snapshot.user.accessKey?.key ?? '—'}
          />
          <InfoRow
            label="Дата регистрации :"
            value={formatDate(snapshot.user.createdAt)}
          />
          <InfoRow
            label="Согласие на рассылку :"
            value={snapshot.user.consentMarketing ? 'да' : 'нет'}
          />
          <div className="contents">
            <span className="text-sm text-admin-placeholder">Статус :</span>
            <div className="flex items-center justify-between">
              <span className="text-sm text-admin-label">
                {isBlocked ? 'заблокирован' : 'активный'}
              </span>
              <button
                onClick={() => setShowBanDialog(true)}
                className="px-4 py-1.5 rounded-lg text-sm text-white bg-admin-input-text hover:bg-gray-800 transition-colors"
              >
                {isBlocked ? 'Разблокировать' : 'Заблокировать'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Прогресс */}
      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-6 mb-6">
        <h2 className="text-base font-semibold text-admin-input-text mb-1">
          Прогресс
        </h2>
        {progress !== null && (
          <p className="text-sm text-admin-placeholder mb-4">
            {progress.completed} / {progress.total} миссий ({progress.percent}%)
          </p>
        )}

        <div className="divide-y divide-admin-card-border">
          {missionList.length === 0 ? (
            <p className="text-sm text-admin-placeholder py-3">Миссии не начаты</p>
          ) : (
            missionList.map((mission, index) => {
              const isCurrentMission = index === currentMissionIndex;
              return (
                <div
                  key={mission.slotKey}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-admin-input-text">
                      {mission.slotKey}
                    </p>
                    <MissionStatusLabel
                      completed={mission.completed}
                      inProgress={isCurrentMission && !mission.completed}
                    />
                  </div>

                  {isCurrentMission && !mission.completed && (
                    <div className="flex items-center gap-2">
                      <button
                        disabled
                        title="Недоступно до Фазы 10+"
                        className="px-3 py-1.5 rounded-lg text-xs text-admin-placeholder border border-admin-card-border cursor-not-allowed opacity-50"
                      >
                        Сбросить
                      </button>
                      <button
                        disabled
                        title="Недоступно до Фазы 10+"
                        className="px-3 py-1.5 rounded-lg text-xs text-admin-placeholder border border-admin-card-border cursor-not-allowed opacity-50"
                      >
                        Отметить пройденной
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Игровой прогресс */}
      {snapshot.gameProgress && (
        <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-6 mb-6">
          <h2 className="text-base font-semibold text-admin-input-text mb-4">
            Игровой прогресс
          </h2>
          <div className="space-y-2 text-sm">
            <DataRow
              label="Марина разблокирована"
              value={snapshot.gameProgress.marinaTriggered ? 'да' : 'нет'}
            />
            <DataRow
              label="Финальный отчет"
              value={snapshot.gameProgress.finalReportDone ? 'пройден' : 'не пройден'}
            />
            <DataRow
              label="Итоговый балл"
              value={
                snapshot.gameProgress.finalScore !== null
                  ? String(snapshot.gameProgress.finalScore)
                  : '—'
              }
            />
          </div>
        </div>
      )}

      {/* Чат-стейт */}
      {snapshot.chatState && (
        <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-6 mb-6">
          <h2 className="text-base font-semibold text-admin-input-text mb-4">
            Чат-стейт
          </h2>
          <div className="space-y-2 text-sm">
            <DataRow
              label="Текущее сообщение Детектива"
              value={
                snapshot.chatState.currentDetectiveMessage
                  ? `[${snapshot.chatState.currentDetectiveMessage.code}] ${snapshot.chatState.currentDetectiveMessage.text}`
                  : '—'
              }
            />
            <DataRow
              label="Текущее сообщение Марины"
              value={
                snapshot.chatState.currentMarinaMessage
                  ? `[${snapshot.chatState.currentMarinaMessage.code}] ${snapshot.chatState.currentMarinaMessage.text}`
                  : '—'
              }
            />
            <DataRow
              label="Финальный выбор"
              value={snapshot.chatState.finalChoice ?? '—'}
            />
            <DataRow
              label="Детектив завершен"
              value={snapshot.chatState.detectiveFinished ? 'да' : 'нет'}
            />
            <DataRow
              label="Марина завершена"
              value={snapshot.chatState.marinaFinished ? 'да' : 'нет'}
            />
            {Object.keys(snapshot.chatState.playerChoices).length > 0 && (
              <div>
                <p className="text-admin-placeholder mb-1">Выборы игрока:</p>
                <pre className="bg-admin-input-bg rounded p-2 text-xs text-admin-label overflow-auto max-h-32">
                  {JSON.stringify(snapshot.chatState.playerChoices, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Крэк-сессии */}
      {snapshot.crackSessions.length > 0 && (
        <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-6 mb-6">
          <h2 className="text-base font-semibold text-admin-input-text mb-4">
            Крэк-сессии
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-card-border">
                <th className="text-left py-2 text-admin-placeholder font-medium">Слот</th>
                <th className="text-left py-2 text-admin-placeholder font-medium">Попыток</th>
                <th className="text-left py-2 text-admin-placeholder font-medium">Лимит</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.crackSessions.map((s) => (
                <tr key={s.slotKey} className="border-b border-admin-card-border last:border-0">
                  <td className="py-2 text-admin-label font-mono">{s.slotKey}</td>
                  <td className="py-2 text-admin-label">{s.attemptsUsed}</td>
                  <td className="py-2 text-admin-label">{s.maxAttempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Подсказки */}
      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-6 mb-6">
        <h2 className="text-base font-semibold text-admin-input-text mb-2">
          Подсказки
        </h2>
        <p className="text-sm text-admin-label">
          {snapshot.hintProgress !== null
            ? `Последний просмотренный индекс: ${snapshot.hintProgress.lastSeenHintIndex}`
            : 'Нет записи'}
        </p>
      </div>

      {/* История прохождений */}
      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-6 mb-6">
        <h2 className="text-base font-semibold text-admin-input-text mb-1">
          История прохождений
        </h2>
        <p className="text-sm text-admin-placeholder mb-4">
          Завершённых игр: {snapshot.completions.length}
        </p>

        {snapshot.completions.length === 0 ? (
          <p className="text-sm text-admin-placeholder">Игра ещё не завершена</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-card-border">
                <th className="text-left py-2 text-admin-placeholder font-medium">#</th>
                <th className="text-left py-2 text-admin-placeholder font-medium">Дата завершения</th>
                <th className="text-left py-2 text-admin-placeholder font-medium">Счёт</th>
                <th className="text-left py-2 text-admin-placeholder font-medium">Время прохождения</th>
                <th className="text-left py-2 text-admin-placeholder font-medium">IP</th>
                <th className="text-left py-2 text-admin-placeholder font-medium">User-Agent</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.completions.map((c, index) => (
                <tr key={c.id} className="border-b border-admin-card-border last:border-0">
                  <td className="py-2 text-admin-placeholder">{snapshot.completions.length - index}</td>
                  <td className="py-2 text-admin-label whitespace-nowrap">{formatDateTime(c.completedAt)}</td>
                  <td className="py-2 text-admin-label">
                    {c.finalScore !== null ? `${c.finalScore}%` : '—'}
                  </td>
                  <td className="py-2 text-admin-label">
                    {c.durationSeconds !== null ? formatDuration(c.durationSeconds) : '—'}
                  </td>
                  <td className="py-2 text-admin-label font-mono text-xs">{c.ipAddress ?? '—'}</td>
                  <td className="py-2 text-admin-placeholder text-xs max-w-xs truncate" title={c.userAgent ?? ''}>
                    {c.userAgent ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Логи */}
      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border p-6">
        <h2 className="text-base font-semibold text-admin-input-text mb-1">
          Логи операций
        </h2>
        <p className="text-sm text-admin-placeholder mb-4">
          Всего: {snapshot.logsCount}
        </p>

        {snapshot.recentLogs.length === 0 ? (
          <p className="text-sm text-admin-placeholder">Логи отсутствуют</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-card-border">
                <th className="text-left py-2 text-admin-placeholder font-medium">Тип</th>
                <th className="text-left py-2 text-admin-placeholder font-medium">Сообщение</th>
                <th className="text-left py-2 text-admin-placeholder font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.recentLogs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-admin-card-border last:border-0"
                >
                  <td className="py-2 text-admin-label font-mono text-xs">{log.type}</td>
                  <td className="py-2 text-admin-label">{log.message}</td>
                  <td className="py-2 text-admin-placeholder whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showBanDialog && (
        <BanUserDialog
          userId={snapshot.user.id}
          userEmail={snapshot.user.email}
          currentIsBlocked={isBlocked}
          onSuccess={(updatedIsBlocked) => setIsBlocked(updatedIsBlocked)}
          onClose={() => setShowBanDialog(false)}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <>
      <span className="text-sm text-admin-placeholder">{label}</span>
      <span className="text-sm text-admin-label">{value}</span>
    </>
  );
}

function DataRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex items-start gap-4">
      <span className="text-admin-placeholder min-w-[200px]">{label}</span>
      <span className="text-admin-label">{value}</span>
    </div>
  );
}
