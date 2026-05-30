import { AdminForm } from '@/components/admin/admins/AdminForm';

export const metadata = {
  title: 'Добавить администратора',
};

export default function NewAdminPage(): React.ReactElement {
  return <AdminForm />;
}
