import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VerifyForm } from '@/components/VerifyForm';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { t } from '@/lib/i18n';

export default async function ReadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  const { id } = await params;

  const reading = await prisma.reading.findUnique({
    where: { id },
    select: { technicianId: true },
  });
  if (!reading) notFound();
  if (reading.technicianId !== user.id) notFound();

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
