import Link from 'next/link';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { readingToDto } from '@/lib/dto';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function ReadingsPage() {
  const user = await currentUser();

  const readings = await prisma.reading.findMany({
    where: { technicianId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { photos: true, primaryPhoto: true },
  });

  if (readings.length === 0) {
    return <p className="text-sm text-slate-600">{t('readings.empty')}</p>;
  }

  return (
    <ul className="space-y-2">
      {readings.map((r) => {
        const dto = readingToDto(r);
        const status = dto.verifiedAt
          ? t('readings.verified')
          : dto.ocrStatus === 'pending'
            ? t('readings.statusPending')
            : dto.ocrStatus === 'failed'
              ? t('readings.statusFailed')
              : t('readings.statusDone');
        return (
          <li key={dto.id}>
            <Link
              href={`/readings/${dto.id}`}
              className="flex items-center gap-3 rounded-lg border bg-white p-3 hover:bg-slate-50"
            >
              {dto.primaryPhotoId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/photos/${dto.primaryPhotoId}`}
                  alt=""
                  className="h-16 w-16 flex-none rounded-md object-cover"
                />
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">
                  {dto.serialNumber ?? '—'}
                  {dto.consumedVolume && ` · ${dto.consumedVolume} m³`}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(dto.createdAt).toLocaleString('de')} · {status}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
