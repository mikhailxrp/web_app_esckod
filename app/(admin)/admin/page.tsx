import { prisma } from '@/lib/prisma';
import {
  Users,
  Key,
  TrendingDown,
  KeyRound,
  Monitor,
} from 'lucide-react';
import { DevResetAllButton } from '@/components/admin/DevResetAllButton';
import { MetricsAutoRefresh } from '@/components/admin/MetricsAutoRefresh';
import { RegistrationChart, type DayData } from '@/components/admin/analytics/RegistrationChart';

// ─── Types ────────────────────────────────────────────────────────────────────

type RegistrationRow = { label: number; count: bigint };

type SlotStats = {
  slotKey: string;
  displayName: string;
  total: number;
  skipped: number;
  totalAttempts: number;
  failedAttempts: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function fillWeek(raw: RegistrationRow[]): DayData[] {
  const map = new Map(raw.map((r) => [Number(r.label), Number(r.count)]));
  return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label, i) => ({
    label,
    count: map.get(i + 1) ?? 0,
  }));
}

function fillMonth(raw: RegistrationRow[]): DayData[] {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const map = new Map(raw.map((r) => [Number(r.label), Number(r.count)]));
  return Array.from({ length: daysInMonth }, (_, i) => ({
    label: String(i + 1),
    count: map.get(i + 1) ?? 0,
  }));
}

function fillYear(raw: RegistrationRow[]): DayData[] {
  const map = new Map(raw.map((r) => [Number(r.label), Number(r.count)]));
  return ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'].map(
    (label, i) => ({ label, count: map.get(i + 1) ?? 0 }),
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return 'нет данных';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} мин.`;
  return m === 0 ? `${h} ч.` : `${h} ч. ${m} мин.`;
}

function computeGaugePaths(completedRatio: number): {
  completedPath: string;
  inProgressPath: string;
  trackPath: string;
  dotX: number;
  dotY: number;
} {
  const cx = 100;
  const cy = 100;
  const r = 75;
  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // Clamp to [0.05, 0.95] to keep chord well below 2r (avoids degenerate SVG arcs
  // near the endpoints where chord → 2r and browser rendering becomes unreliable).
  const safeRatio = Math.max(0.05, Math.min(0.95, completedRatio));
  const angle = Math.PI * (1 - safeRatio);
  const midX = cx + r * Math.cos(angle);
  const midY = cy - r * Math.sin(angle);

  return {
    trackPath,
    completedPath: `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${midX.toFixed(2)} ${midY.toFixed(2)}`,
    inProgressPath: `M ${midX.toFixed(2)} ${midY.toFixed(2)} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`,
    dotX: midX,
    dotY: midY,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconWrapClassName?: string;
}

function GeneralStatCard({
  label,
  value,
  icon,
  iconWrapClassName = 'bg-admin-accent-muted text-admin-accent',
}: StatCardProps): React.ReactElement {
  return (
    <div className="p-4 bg-white rounded-xl border border-admin-card-border">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${iconWrapClassName}`}
        >
          {icon}
        </div>
        <p className="text-[14px] text-admin-label leading-tight">{label}</p>
      </div>
      <p className="text-5xl font-medium text-admin-input-text leading-none">{value.toLocaleString('ru')}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminPage(): Promise<React.ReactElement> {
  const [
    totalUsers,
    activatedKeys,
    unusedKeys,
    maxActivationsKeys,
    uniqueCompleters,
    totalCompletions,
    totalWithProgress,
    weekRaw,
    monthRaw,
    yearRaw,
    avgTimeRaw,
    activeSlots,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.accessKey.count({ where: { currentActivations: { gt: 0 } } }),
    prisma.accessKey.count({ where: { currentActivations: 0 } }),
    prisma.accessKey.count({ where: { currentActivations: { gte: 5 } } }),
    // Unique users who EVER completed (current finalReportDone=true OR historical GameCompletion record)
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM (
        SELECT "userId" FROM "GameProgress" WHERE "finalReportDone" = true
        UNION
        SELECT "userId" FROM "GameCompletion"
      ) AS combined
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.gameCompletion.count(),
    // Players currently in progress (have GameProgress, not yet done)
    prisma.gameProgress.count({ where: { finalReportDone: false } }),

    // Weekly: ISODOW 1=Mon .. 7=Sun
    prisma.$queryRaw<RegistrationRow[]>`
      SELECT EXTRACT(ISODOW FROM "createdAt")::int AS label, COUNT(*)::bigint AS count
      FROM "User"
      WHERE "createdAt" >= DATE_TRUNC('week', NOW())
        AND "createdAt" < DATE_TRUNC('week', NOW()) + INTERVAL '7 days'
      GROUP BY EXTRACT(ISODOW FROM "createdAt")
    `,

    // Monthly: day of month 1..31
    prisma.$queryRaw<RegistrationRow[]>`
      SELECT EXTRACT(DAY FROM "createdAt")::int AS label, COUNT(*)::bigint AS count
      FROM "User"
      WHERE "createdAt" >= DATE_TRUNC('month', NOW())
        AND "createdAt" < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
      GROUP BY EXTRACT(DAY FROM "createdAt")
    `,

    // Yearly: month 1..12
    prisma.$queryRaw<RegistrationRow[]>`
      SELECT EXTRACT(MONTH FROM "createdAt")::int AS label, COUNT(*)::bigint AS count
      FROM "User"
      WHERE "createdAt" >= DATE_TRUNC('year', NOW())
      GROUP BY EXTRACT(MONTH FROM "createdAt")
    `,

    // Average completion time (onboarding → final report)
    prisma.$queryRaw<Array<{ avg_seconds: number | null }>>`
      WITH onboarding AS (
        SELECT "userId", MIN("createdAt") AS onboarding_at
        FROM "OperationLog"
        WHERE message = 'Подключение установлено'
        GROUP BY "userId"
      ),
      final_report AS (
        SELECT "userId", MIN("createdAt") AS final_at
        FROM "OperationLog"
        WHERE message LIKE 'Финальный отчет сдан%'
        GROUP BY "userId"
      )
      SELECT EXTRACT(EPOCH FROM AVG(final_report.final_at - onboarding.onboarding_at))::float AS avg_seconds
      FROM onboarding
      INNER JOIN final_report ON final_report."userId" = onboarding."userId"
      WHERE final_report.final_at >= onboarding.onboarding_at
    `,

    prisma.missionSlot.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, slotKey: true, displayName: true, missionType: true },
    }),
  ]);

  // ── Mission slot stats (batch query) ──
  const slotIds = activeSlots.map((s) => s.id);

  const allProgresses =
    slotIds.length > 0
      ? await prisma.missionProgress.findMany({
          where: { slotId: { in: slotIds } },
          select: { slotId: true, completed: true, metadata: true },
        })
      : [];

  const slotStatsMap = new Map<string, SlotStats>();

  for (const slot of activeSlots) {
    const records = allProgresses.filter((p) => p.slotId === slot.id);
    const total = records.length;

    const skipped = records.filter((p) => {
      const meta = p.metadata as Record<string, unknown> | null;
      return meta?.skipped === true;
    }).length;

    // Неудачные попытки прохождения = проваленные прогоны мини-игры:
    //   CRACK — пересоздания поля (failedSessionsCount),
    //   DECIPHER — накопительные неверные вводы (failedAttempts),
    //   RDP — истечения таймера со сбросом пазла (timerExpiredCount; только сценарий 2,
    //         в сценарии 1 пазл бесконечный и провалить его нельзя → всегда 0).
    // Успешная попытка = миссия пройдена не пропуском (completed && !skipped) — ровно одна.
    // Общее число попыток = failedAttempts + successfulAttempts.
    let failedAttempts = 0;
    let successfulAttempts = 0;

    for (const p of records) {
      const meta = p.metadata as Record<string, unknown> | null;

      if (slot.missionType === 'CRACK') {
        failedAttempts += Number(meta?.failedSessionsCount ?? 0);
      } else if (slot.missionType === 'DECIPHER') {
        failedAttempts += Number(meta?.failedAttempts ?? 0);
      } else if (slot.missionType === 'RDP') {
        failedAttempts += Number(meta?.timerExpiredCount ?? 0);
      }

      if (p.completed && meta?.skipped !== true) {
        successfulAttempts += 1;
      }
    }

    const totalAttempts = failedAttempts + successfulAttempts;

    slotStatsMap.set(slot.id, {
      slotKey: slot.slotKey,
      displayName: slot.displayName,
      total,
      skipped,
      totalAttempts,
      failedAttempts,
    });
  }

  const slotStats = activeSlots.map((s) => slotStatsMap.get(s.id)!).filter(Boolean);

  // ── Chart data ──
  const weekData = fillWeek(weekRaw);
  const monthData = fillMonth(monthRaw);
  const yearData = fillYear(yearRaw);

  const avgSeconds = avgTimeRaw[0]?.avg_seconds ?? null;
  const avgDuration = formatDuration(avgSeconds ?? 0);

  // ── Player progress gauge ──
  const inProgress = totalWithProgress;
  const gaugeTotal = uniqueCompleters + inProgress;
  const completedRatio = gaugeTotal > 0 ? uniqueCompleters / gaugeTotal : 0;
  const { completedPath, inProgressPath, trackPath, dotX, dotY } = computeGaugePaths(completedRatio);
  const completedPct = gaugeTotal > 0 ? Math.round((uniqueCompleters / gaugeTotal) * 100) : 0;
  const inProgressPct = 100 - completedPct;
  const desktopShare = totalUsers > 0 ? '100.00%' : '—';

  return (
    <>
      <MetricsAutoRefresh />
      <h1 className="text-xl font-semibold text-admin-input-text mb-6">Метрики</h1>

      <div className="flex items-start gap-4 mb-4">
        {/* Left column */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <RegistrationChart week={weekData} month={monthData} year={yearData} />

          <div className="p-6 bg-white rounded-xl border border-admin-card-border shadow-admin-card">
          <div className="flex items-baseline gap-3 mb-4">
            <p className="text-[16px] font-semibold text-admin-input-text">Игровые показатели</p>
            {avgSeconds && avgSeconds > 0 && (
              <span className="text-[14px] text-admin-label">
                Среднее время прохождения: {avgDuration}
              </span>
            )}
          </div>

          {slotStats.length === 0 ? (
            <p className="text-[14px] text-admin-label">Нет активных слотов миссий</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {slotStats.map((stat) => (
                <div
                  key={stat.slotKey}
                  className="p-3 rounded-lg border border-admin-card-border bg-gray-50"
                >
                  <p
                    className="text-[16px] font-medium text-admin-accent mb-2 truncate"
                    title={stat.displayName}
                  >
                    {stat.displayName}
                  </p>
                  <div className="space-y-1">
                    <p className="text-[14px] text-admin-label">
                      Неудачные попытки:{' '}
                      <span className="font-medium text-admin-input-text">
                        {pct(stat.failedAttempts, stat.totalAttempts)}
                      </span>
                    </p>
                    <p className="text-[14px] text-admin-label">
                      Пропуск:{' '}
                      <span className="font-medium text-admin-input-text">
                        {pct(stat.skipped, stat.total)}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

            {/* Player progress */}
            <div className="mt-6">
            <p className="text-[16px] font-semibold text-admin-input-text mb-3">Прогресс игроков</p>
            <div className="flex items-end justify-between gap-6">
              {/* Gauge */}
              <div className="relative w-[320px] shrink-0">
                <svg width="280" height="150" viewBox="0 0 200 110" className="w-full h-auto">
                  <path d={trackPath} stroke="#E5E7EB" strokeWidth="14" fill="none" strokeLinecap="round" />
                  {gaugeTotal > 0 && (
                    <>
                      {uniqueCompleters > 0 && (
                        <path
                          d={inProgress === 0 ? trackPath : completedPath}
                          stroke="#6E39CB"
                          strokeWidth="14"
                          fill="none"
                          strokeLinecap="round"
                        />
                      )}
                      {inProgress > 0 && (
                        <path
                          d={uniqueCompleters === 0 ? trackPath : inProgressPath}
                          stroke="#C4B5FD"
                          strokeWidth="14"
                          fill="none"
                          strokeLinecap="round"
                        />
                      )}
                      {uniqueCompleters > 0 && inProgress > 0 && (
                        <circle cx={dotX} cy={dotY} r="6" fill="white" stroke="#6E39CB" strokeWidth="3" />
                      )}
                    </>
                  )}
                </svg>
                <div className="flex items-start justify-between -mt-2 px-1">
                  <div className="flex items-start gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-admin-accent inline-block" />
                    <div className="leading-tight">
                      <p className="text-[14px] text-admin-label">{completedPct}%</p>
                      <p className="text-[10px] text-admin-placeholder">Завершено</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-300 inline-block" />
                    <div className="leading-tight">
                      <p className="text-[14px] text-admin-label">{inProgressPct}%</p>
                      <p className="text-[10px] text-admin-placeholder">В процессе</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="w-[300px] shrink-0 flex flex-col gap-3">
                <div className="flex items-center gap-2 p-4 rounded-lg border border-admin-card-border bg-white">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-admin-accent-muted text-admin-accent">
                    <Users size={15} />
                  </div>
                  <div>
                    <p className="text-[14px] text-admin-label leading-tight">Завершили игру</p>
                    <p className="text-[44px] font-semibold text-admin-input-text leading-tight">
                      {uniqueCompleters.toLocaleString('ru')}
                    </p>
                    {totalCompletions > uniqueCompleters && (
                      <p className="text-[12px] text-admin-placeholder leading-tight mt-0.5">
                        {totalCompletions.toLocaleString('ru')} прохождений всего (с перезапусками)
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 p-4 rounded-lg border border-admin-card-border bg-white">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 text-violet-400">
                    <Users size={15} />
                  </div>
                  <div>
                    <p className="text-[14px] text-admin-label leading-tight">В процессе</p>
                    <p className="text-[44px] font-semibold text-admin-input-text leading-tight">
                      {inProgress.toLocaleString('ru')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Right column */}
        <div className="w-full max-w-[350px] shrink-0 flex flex-col gap-4">
          <div className="p-5 bg-white rounded-xl border border-admin-card-border shadow-admin-card">
            <p className="text-[16px] font-semibold text-admin-input-text mb-4">Общие показатели</p>
            <div className="grid grid-cols-1 gap-4">
              <GeneralStatCard label="Пользователи" value={totalUsers} icon={<Users size={18} />} />
              <GeneralStatCard
                label="Активированные ключи"
                value={activatedKeys}
                icon={<Key size={16} />}
                iconWrapClassName="bg-red-50 text-red-500"
              />
              <GeneralStatCard
                label="Неиспользованные ключи"
                value={unusedKeys}
                icon={<TrendingDown size={16} />}
                iconWrapClassName="bg-red-50 text-red-500"
              />
              <GeneralStatCard
                label="Ключи с 5+ активациями"
                value={maxActivationsKeys}
                icon={<KeyRound size={16} />}
                iconWrapClassName="bg-red-50 text-red-500"
              />
            </div>
          </div>

          <div className="p-5 bg-white rounded-xl border border-admin-card-border shadow-admin-card">
            <p className="text-[16px] font-semibold text-admin-input-text mb-4">Устройства</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-admin-accent-muted text-admin-accent">
                    <Monitor size={14} />
                  </span>
                  <span className="text-[14px] text-admin-input-text">Desktop</span>
                </div>
                <span className="text-[14px] text-admin-input-text">{desktopShare}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-admin-card-border">
              <p className="text-[14px] text-admin-label">Среднее время прохождения</p>
              <p className="text-[16px] font-semibold text-admin-input-text mt-1">{avgDuration}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dev tools ── */}
      <div className="mt-6 pt-6 border-t border-admin-card-border">
        <p className="text-xs text-admin-label mb-3 uppercase tracking-wide font-medium">
          Инструменты разработки
        </p>
        <DevResetAllButton />
      </div>
    </>
  );
}
