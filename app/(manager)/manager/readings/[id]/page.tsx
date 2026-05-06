import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { t } from '@/lib/i18n';
import { currentUser } from '@/lib/auth';
import { NotesList } from '@/components/manager/NotesList';

export const dynamic = 'force-dynamic';

export default async function ManagerReadingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await currentUser();
  const { id } = await params;
  
  const reading = await prisma.reading.findUnique({
    where: { id },
    include: { primaryPhoto: true, gauge: { include: { site: true } } },
  });

  if (!reading) return notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('manager.readingDetails')}</h1>
        <Link href="/manager/readings" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          {t('common.back')}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left Column: Photo & Details */}
        <div className="space-y-6">
          {/* Primary Photo */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Foto</h2>
            {reading.primaryPhotoId ? (
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded border bg-slate-100">
                <Image
                  src={`/api/photos/${reading.primaryPhotoId}`}
                  alt="Zähler Foto"
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center rounded border bg-slate-50 text-slate-400">
                Kein Foto vorhanden
              </div>
            )}
          </div>

          {/* Extracted Data */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Daten</h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-slate-500">Seriennummer</dt>
                <dd className="font-mono text-base font-medium text-slate-900">
                  {reading.serialNumber || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Verbrauch (m³)</dt>
                <dd className="text-base font-medium text-slate-900">
                  {reading.consumedVolume?.toString() || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="text-base text-slate-900">
                  {reading.verifiedAt
                    ? t('readings.verified')
                    : reading.ocrStatus === 'done'
                      ? t('readings.statusDone')
                      : reading.ocrStatus === 'failed'
                        ? t('readings.statusFailed')
                        : t('readings.statusPending')}
                </dd>
              </div>
              {reading.technicianNote && (
                <div>
                  <dt className="text-slate-500">Notiz des Technikers</dt>
                  <dd className="text-base italic text-slate-800">{reading.technicianNote}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Right Column: Notes */}
        <div className="space-y-6">
          <NotesList
            targetType="photo"
            targetId={reading.primaryPhotoId}
            label={t('manager.noteForPhoto')}
            disabledReason="Kein Foto zugewiesen"
          />
          <NotesList
            targetType="serialNumber"
            targetId={reading.id}
            label={t('manager.noteForSerial')}
          />
          <NotesList
            targetType="gauge"
            targetId={reading.gaugeId}
            label={t('manager.noteForGauge')}
            disabledReason={t('manager.noGaugeError')}
          />
          <NotesList
            targetType="site"
            targetId={reading.gauge?.site?.id ?? null}
            label={t('manager.noteForSite')}
            disabledReason={t('manager.noSiteError')}
          />
        </div>
      </div>
    </div>
  );
}
