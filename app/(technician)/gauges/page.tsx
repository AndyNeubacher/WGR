import Link from 'next/link';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function GaugesPage() {
  const user = await currentUser();

  const gauges = await prisma.gauge.findMany({
    where: {
      assignments: {
        some: { technicianId: user.id },
      },
    },
    orderBy: { createdAt: 'desc' },
    include: { site: { include: { customer: true } } },
  });

  if (gauges.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">{t('gauges.title')}</h1>
        <p className="text-sm text-slate-600">{t('gauges.empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t('gauges.title')}</h1>
      <div className="space-y-2">
        {gauges.map((gauge) => (
          <div
            key={gauge.id}
            className="flex items-center justify-between rounded-lg border bg-white p-4 hover:bg-slate-50"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{gauge.label}</p>
              <p className="text-sm text-slate-500">
                {gauge.site.customer.name} • {gauge.site.name}
              </p>
            </div>
            <Link href={`/capture?gaugeId=${gauge.id}`}>
              <Button className="ml-4">{t('gauges.takePhoto')}</Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
