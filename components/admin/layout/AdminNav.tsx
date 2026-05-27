'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Key,
  Layers,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  ScrollText,
  Settings,
  Shield,
  Users,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  icon: React.ReactNode;
  basePath: string;
  children: { label: string; href: string }[];
}

type NavEntry = NavItem | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

const NAV_ENTRIES: NavEntry[] = [
  {
    label: 'Ключи',
    icon: <Key size={16} />,
    basePath: '/admin/keys',
    children: [
      { label: 'Список', href: '/admin/keys' },
      { label: 'Добавление', href: '/admin/keys/new' },
    ],
  },
  { label: 'Пользователи', href: '/admin/users', icon: <Users size={16} /> },
  {
    label: 'Миссии',
    href: '/admin/mission-slots',
    icon: <Layers size={16} />,
  },
  { label: 'Чаты', href: '/admin/chats', icon: <MessageSquare size={16} /> },
  { label: 'Файлы РДП', href: '/admin/files', icon: <FileText size={16} /> },
  {
    label: 'Финальный отчет',
    href: '/admin/report',
    icon: <ClipboardList size={16} />,
  },
  {
    label: 'Администраторы',
    href: '/admin/admins',
    icon: <Shield size={16} />,
  },
  {
    label: 'Настройки',
    href: '/admin/settings',
    icon: <Settings size={16} />,
  },
  {
    label: 'Подсказки',
    href: '/admin/hints',
    icon: <Lightbulb size={16} />,
  },
  {
    label: 'Аудит',
    href: '/admin/audit-log',
    icon: <ScrollText size={16} />,
  },
];

export function AdminNav(): React.ReactElement {
  const pathname = usePathname();

  // Stores the group the user explicitly toggled (null = no override, follows pathname)
  const [groupOverride, setGroupOverride] = useState<{
    path: string;
    open: boolean;
  } | null>(null);

  const isGroupOpen = (basePath: string): boolean => {
    if (groupOverride?.path === basePath) return groupOverride.open;
    return pathname.startsWith(basePath);
  };

  const toggleGroup = (basePath: string): void => {
    const currentlyOpen = isGroupOpen(basePath);
    setGroupOverride({ path: basePath, open: !currentlyOpen });
  };

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

        {NAV_ENTRIES.map((entry) => {
          if (isNavGroup(entry)) {
            const isGroupActive = pathname.startsWith(entry.basePath);
            const isOpen = isGroupOpen(entry.basePath);

            return (
              <div key={entry.basePath}>
                <button
                  onClick={() => toggleGroup(entry.basePath)}
                  className={[
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isGroupActive
                      ? 'bg-admin-nav-active-bg text-admin-nav-active-text'
                      : 'text-admin-nav-text hover:bg-admin-nav-hover-bg',
                  ].join(' ')}
                >
                  <span className="shrink-0">{entry.icon}</span>
                  <span className="flex-1 text-left leading-tight">
                    {entry.label}
                  </span>
                  {isOpen ? (
                    <ChevronUp size={14} className="shrink-0 opacity-60" />
                  ) : (
                    <ChevronDown size={14} className="shrink-0 opacity-60" />
                  )}
                </button>

                {isOpen && (
                  <div className="ml-5 mt-0.5 flex flex-col gap-0.5">
                    {entry.children.map((child) => {
                      const isChildActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={[
                            'block px-3 py-1.5 rounded-lg text-sm transition-colors',
                            isChildActive
                              ? 'text-admin-nav-active-text font-medium'
                              : 'text-admin-nav-text hover:bg-admin-nav-hover-bg',
                          ].join(' ')}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isActive = pathname.startsWith(entry.href);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className={[
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-admin-nav-active-bg text-admin-nav-active-text'
                  : 'text-admin-nav-text hover:bg-admin-nav-hover-bg',
              ].join(' ')}
            >
              <span className="shrink-0">{entry.icon}</span>
              <span className="flex-1 leading-tight">{entry.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
