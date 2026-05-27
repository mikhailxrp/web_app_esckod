import { AddKeyForm } from '@/components/admin/keys/AddKeyForm';
import { BulkImportForm } from '@/components/admin/keys/BulkImportForm';

export const metadata = {
  title: 'Добавление ключей доступа',
};

export default function KeysNewPage(): React.ReactElement {
  return (
    <>
      <h1 className="text-xl font-semibold text-admin-accent mb-6">
        Добавление ключей доступа
      </h1>
      <div className="max-w-2xl">
        <AddKeyForm />
        <BulkImportForm />
      </div>
    </>
  );
}
