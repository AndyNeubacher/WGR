import Link from 'next/link';
import { t } from '@/lib/i18n';
import { UserMenu } from '@/components/UserMenu';
import { currentUser } from '@/lib/auth';

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <div className="mx-auto flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center space-x-8">
          <Link href="/manager/readings" className="text-lg font-semibold text-slate-900">
            {t('app.title')}{' '}
            <span className="ml-2 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
              {t('manager.title')}
            </span>
          </Link>
          <nav className="flex space-x-6 text-sm font-medium text-slate-600">
            <Link href="/manager/readings" className="hover:text-slate-900">
              {t('manager.readings')}
            </Link>
            <Link href="/manager/users" className="hover:text-slate-900">
              {t('users.title')}
            </Link>
            <Link href="/manager/customers" className="hover:text-slate-900">
              {t('customers.title')}
            </Link>
            <Link href="/manager/sites" className="hover:text-slate-900">
              {t('sites.title')}
            </Link>
            <Link href="/manager/gauges" className="hover:text-slate-900">
              {t('gaugesAdmin.title')}
            </Link>
          </nav>
        </div>
        <UserMenu name={user.name} role={user.role} />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
