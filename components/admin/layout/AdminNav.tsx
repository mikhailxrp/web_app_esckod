'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Key,
  Users,
  Shield,
  Settings,
  Layers,
  MessageSquare,
  FileText,
  ClipboardList,
  Lightbulb,
  ScrollText,
  ChevronDown,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  hasChevron?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Ключи',
    href: '/admin/keys',
    icon: <Key size={16} />,
    hasChevron: true,
  },
  {
    label: 'Пользователи',
    href: '/admin/users',
    icon: <Users size={16} />,
    hasChevron: true,
  },
  {
    label: 'Миссии',
    href: '/admin/mission-slots',
    icon: <Layers size={16} />,
    hasChevron: true,
  },
  {
    label: 'Чаты',
    href: '/admin/chats',
    icon: <MessageSquare size={16} />,
    hasChevron: true,
  },
  {
    label: 'Файлы РДП',
    href: '/admin/files',
    icon: <FileText size={16} />,
    hasChevron: true,
  },
  {
    label: 'Финальный отчет',
    href: '/admin/report',
    icon: <ClipboardList size={16} />,
    hasChevron: true,
  },
  {
    label: 'Администраторы',
    href: '/admin/admins',
    icon: <Shield size={16} />,
    hasChevron: false,
  },
  {
    label: 'Настройки',
    href: '/admin/settings',
    icon: <Settings size={16} />,
    hasChevron: true,
  },
  {
    label: 'Подсказки',
    href: '/admin/hints',
    icon: <Lightbulb size={16} />,
    hasChevron: true,
  },
  {
    label: 'Аудит',
    href: '/admin/audit-log',
    icon: <ScrollText size={16} />,
    hasChevron: false,
  },
];

export function AdminNav(): React.ReactElement {
  const pathname = usePathname();

  const isActive = (href: string): boolean => pathname.startsWith(href);

  return (
    <aside className="w-[220px] min-h-screen bg-admin-sidebar-bg border-r border-admin-sidebar-border flex flex-col shrink-0">
      <div className="flex justify-center pt-5 pb-6">
        <Image
          src="/assets/img/admin/small-logo.png"
          alt="Логотип"
          width={40}
          height={40}
          priority
        />
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        <Link
          href="/admin"
          className={[
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            pathname === '/admin'
              ? 'bg-admin-nav-active-bg text-admin-nav-active-text'
              : 'text-admin-nav-text hover:bg-admin-nav-hover-bg',
          ].join(' ')}
        >
          <LayoutDashboard size={16} />
          <span>Главная</span>
        </Link>

        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={[
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-admin-nav-active-bg text-admin-nav-active-text'
                : 'text-admin-nav-text hover:bg-admin-nav-hover-bg',
            ].join(' ')}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="flex-1 leading-tight">{item.label}</span>
            {item.hasChevron && (
              <ChevronDown size={14} className="shrink-0 opacity-50" />
            )}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
