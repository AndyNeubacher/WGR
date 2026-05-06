import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  await requireRole('manager');
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('customers.title')}</h1>
      {customers.length === 0 ? (
        <p className="text-slate-500">No customers yet</p>
      ) : (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b">
              <tr>
                <th className="pb-3 pr-4 font-medium">{t('customers.name')}</th>
                <th className="pb-3 font-medium">{t('customers.createdAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="py-3 pr-4 font-medium">{c.name}</td>
                  <td className="py-3">{new Date(c.createdAt).toLocaleDateString('de-DE')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
