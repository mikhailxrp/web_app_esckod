import { prisma } from '@/lib/prisma';
import { Key, Users, Layers } from 'lucide-react';
import { DevResetAllButton } from '@/components/admin/DevResetAllButton';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps): React.ReactElement {
  return (
    <div className="flex items-center gap-4 p-6 bg-white rounded-xl border border-admin-card-border shadow-admin-card">
      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-admin-accent-muted text-admin-accent">
        {icon}
      </div>
      <div>
        <p className="text-sm text-admin-label">{label}</p>
        <p className="text-2xl font-bold text-admin-input-text">{value}</p>
      </div>
    </div>
  );
}

export default async function AdminPage(): Promise<React.ReactElement> {
  const [keysCount, usersCount, slotsCount] = await Promise.all([
    prisma.accessKey.count(),
    prisma.user.count(),
    prisma.missionSlot.count({ where: { isActive: true } }),
  ]);

  return (
    <>
      <h1 className="text-xl font-semibold text-admin-input-text mb-6">
        Метрики
      </h1>
      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        <StatCard
          label="Ключи доступа"
          value={keysCount}
          icon={<Key size={22} />}
        />
        <StatCard
          label="Игроки"
          value={usersCount}
          icon={<Users size={22} />}
        />
        <StatCard
          label="Активные слоты миссий"
          value={slotsCount}
          icon={<Layers size={22} />}
        />
      </div>

      <div className="mt-8 pt-6 border-t border-admin-card-border">
        <p className="text-xs text-admin-label mb-3 uppercase tracking-wide font-medium">
          Инструменты разработки
        </p>
        <DevResetAllButton />
      </div>
    </>
  );
}
