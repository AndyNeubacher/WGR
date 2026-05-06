import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { userToDto } from '@/lib/dto';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  await requireRole('manager');

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('users.title')}</h1>
        <Link href="/manager/users/new">
          <Button>{t('users.new')}</Button>
        </Link>
      </div>

      {users.length === 0 ? (
        <p className="text-slate-500">No users yet</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white p-6 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="pb-3 pr-4 font-medium">{t('users.name')}</th>
                <th className="pb-3 pr-4 font-medium">{t('users.email')}</th>
                <th className="pb-3 pr-4 font-medium">{t('users.role')}</th>
                <th className="pb-3 font-medium">{t('users.createdAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/manager/users/${u.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {u.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{u.email}</td>
                  <td className="py-3 pr-4">
                    {u.role === 'manager' ? t('users.roleManager') : t('users.roleTechnician')}
                  </td>
                  <td className="py-3">{new Date(u.createdAt).toLocaleDateString('de-DE')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
