import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function SitesPage() {
  await requireRole('manager');
  const sites = await prisma.site.findMany({
    orderBy: { createdAt: 'desc' },
    include: { customer: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('sites.title')}</h1>
      {sites.length === 0 ? (
        <p className="text-slate-500">No sites yet</p>
      ) : (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b">
              <tr>
                <th className="pb-3 pr-4 font-medium">{t('sites.name')}</th>
                <th className="pb-3 pr-4 font-medium">{t('sites.customer')}</th>
                <th className="pb-3 pr-4 font-medium">{t('sites.address')}</th>
                <th className="pb-3 font-medium">{t('sites.createdAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sites.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="py-3 pr-4 font-medium">{s.name}</td>
                  <td className="py-3 pr-4">{s.customer.name}</td>
                  <td className="py-3 pr-4 text-slate-500">{s.address || '-'}</td>
                  <td className="py-3">{new Date(s.createdAt).toLocaleDateString('de-DE')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
