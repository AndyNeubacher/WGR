import Link from 'next/link';
import { t } from '@/lib/i18n';
import { QueueIndicator } from '@/components/QueueIndicator';

export default function TechnicianLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-screen-sm flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
        <Link href="/capture" className="text-base font-semibold">
          {t('app.title')}
        </Link>
        <QueueIndicator />
      </header>
      <nav className="flex border-b bg-white text-sm">
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
