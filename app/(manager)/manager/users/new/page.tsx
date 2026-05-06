import Link from 'next/link';
import { CreateUserForm } from '@/components/manager/CreateUserForm';
import { requireRole } from '@/lib/auth';
import { t } from '@/lib/i18n';

export default async function NewUserPage() {
  await requireRole('manager');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('users.new')}</h1>
        <Link href="/manager/users" className="text-sm text-slate-600 hover:text-slate-900">
          {t('common.back')}
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <CreateUserForm />
      </div>
    </div>
  );
}
