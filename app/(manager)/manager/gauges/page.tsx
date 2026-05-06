import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function GaugesPage() {
  await requireRole('manager');
  const gauges = await prisma.gauge.findMany({
    orderBy: { createdAt: 'desc' },
    include: { site: { include: { customer: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('gaugesAdmin.title')}</h1>
      {gauges.length === 0 ? (
        <p className="text-slate-500">No gauges yet</p>
      ) : (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b">
              <tr>
                <th className="pb-3 pr-4 font-medium">{t('gaugesAdmin.label')}</th>
                <th className="pb-3 pr-4 font-medium">{t('sites.name')}</th>
                <th className="pb-3 pr-4 font-medium">{t('customers.name')}</th>
                <th className="pb-3 font-medium">{t('gaugesAdmin.createdAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {gauges.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50">
                  <td className="py-3 pr-4 font-medium">{g.label}</td>
                  <td className="py-3 pr-4">{g.site.name}</td>
                  <td className="py-3 pr-4">{g.site.customer.name}</td>
                  <td className="py-3">{new Date(g.createdAt).toLocaleDateString('de-DE')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
