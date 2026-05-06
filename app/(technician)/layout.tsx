import Link from 'next/link';
import { t } from '@/lib/i18n';
import { QueueIndicator } from '@/components/QueueIndicator';
import { UserMenu } from '@/components/UserMenu';
import { currentUser } from '@/lib/auth';

export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <div className="mx-auto flex min-h-dvh max-w-screen-sm flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white px-4 py-3">
        <Link href="/gauges" className="text-base font-semibold">
          {t('app.title')}
        </Link>
        <div className="flex items-center gap-3">
          <QueueIndicator />
          <UserMenu name={user.name} role={user.role} />
        </div>
      </header>
      <nav className="flex border-b bg-white text-sm">
        <Link href="/gauges" className="flex-1 px-4 py-3 text-center hover:bg-slate-50">
          {t('gauges.title')}
        </Link>
        <Link href="/capture" className="flex-1 px-4 py-3 text-center hover:bg-slate-50">
          {t('nav.capture')}
        </Link>
        <Link href="/readings" className="flex-1 px-4 py-3 text-center hover:bg-slate-50">
          {t('nav.readings')}
        </Link>
      </nav>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
