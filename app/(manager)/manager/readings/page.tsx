import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/db';
import { t } from '@/lib/i18n';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ManagerReadingsPage() {
  await currentUser();
  const readings = await prisma.reading.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { primaryPhoto: true },
  });

  return (
    <div className="mx-auto max-w-5xl rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-2xl font-bold">{t('manager.readings')}</h1>
      
      {readings.length === 0 ? (
        <p className="text-slate-500">{t('readings.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="pb-3 pr-4 font-medium">Foto</th>
                <th className="pb-3 pr-4 font-medium">Datum</th>
                <th className="pb-3 pr-4 font-medium">Seriennummer</th>
                <th className="pb-3 pr-4 font-medium">Verbrauch</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {readings.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="py-3 pr-4">
                    {r.primaryPhotoId ? (
                      <div className="relative h-12 w-12 overflow-hidden rounded border bg-slate-100">
                        <Image
                          src={`/api/photos/${r.primaryPhotoId}`}
                          alt=""
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded border bg-slate-100" />
                    )}
                  </td>
                  <td className="py-3 pr-4">{new Date(r.createdAt).toLocaleString('de-DE')}</td>
                  <td className="py-3 pr-4 font-mono">{r.serialNumber || '-'}</td>
                  <td className="py-3 pr-4">{r.consumedVolume?.toString() || '-'}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        r.verifiedAt
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.ocrStatus === 'done'
                            ? 'bg-blue-100 text-blue-800'
                            : r.ocrStatus === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.verifiedAt
                        ? t('readings.verified')
                        : r.ocrStatus === 'done'
                          ? t('readings.statusDone')
                          : r.ocrStatus === 'failed'
                            ? t('readings.statusFailed')
                            : t('readings.statusPending')}
                    </span>
                  </td>
                  <td className="py-3">
                    <Link
                      href={`/manager/readings/${r.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
