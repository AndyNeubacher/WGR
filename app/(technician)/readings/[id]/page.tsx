import Link from 'next/link';
import { VerifyForm } from '@/components/VerifyForm';
import { t } from '@/lib/i18n';

export default async function ReadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('verify.title')}</h1>
        <Link href="/readings" className="text-sm text-slate-600 hover:underline">
          {t('common.back')}
        </Link>
      </div>
      <VerifyForm id={id} />
    </div>
  );
}
