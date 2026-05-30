'use client';

import Link from 'next/link';
import type { AdminListItem } from '@/types/admin-admins';

interface AdminsTableProps {
  admins: AdminListItem[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function AdminsTable({ admins }: AdminsTableProps): React.ReactElement {
  return (
    <div>
      <h1 className="text-xl font-semibold text-admin-accent mb-6">
        Управление администраторами
      </h1>

      <div className="bg-white rounded-xl shadow-admin-card border border-admin-card-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-admin-card-border">
              <th className="text-left px-6 py-3 text-sm font-medium text-admin-input-text">
                Email
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-admin-input-text">
                Статус
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium text-admin-input-text">
                Дата регистрации
              </th>
              <th className="px-6 py-3 w-28" />
            </tr>
          </thead>

          <tbody>
            {admins.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-center py-10 text-sm text-admin-placeholder"
                >
                  Администраторы не найдены
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr
                  key={admin.id}
                  className="border-b border-admin-card-border last:border-b-0 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-6 py-3 text-sm text-admin-placeholder">
                    {admin.email}
                  </td>

                  <td className="px-6 py-3 text-sm text-emerald-600">
                    Активный
                  </td>

                  <td className="px-6 py-3 text-sm text-admin-label">
                    {formatDate(admin.createdAt)}
                  </td>

                  <td className="px-6 py-3 text-right">
                    <Link
                      href={`/admin/admins/${admin.id}`}
                      className="px-4 py-1.5 rounded-lg text-xs text-white bg-admin-input-text hover:bg-gray-800 transition-colors"
                    >
                      Детали
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center mt-6">
        <Link
          href="/admin/admins/new"
          className="px-6 py-2 rounded-lg text-sm text-white bg-admin-accent hover:bg-admin-accent-hover transition-colors"
        >
          Добавить
        </Link>
      </div>
    </div>
  );
}
