'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { t } from '@/lib/i18n';
import { fetchReading, updateReading } from '@/lib/api-client';
import { AuxiliaryPhotos } from './AuxiliaryPhotos';

type FormShape = {
  serialNumber: string;
  consumedVolume: string;
  technicianNote: string;
};

export function VerifyForm({ id }: { id: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['reading', id],
    queryFn: () => fetchReading(id),
    refetchInterval: (q) => (q.state.data?.ocrStatus === 'pending' ? 2000 : false),
  });

  const form = useForm<FormShape>({
    defaultValues: { serialNumber: '', consumedVolume: '', technicianNote: '' },
  });

  useEffect(() => {
    if (!data || data.ocrStatus === 'pending') return;
    form.reset({
      serialNumber: data.serialNumber ?? '',
      consumedVolume: data.consumedVolume ?? '',
      technicianNote: data.technicianNote ?? '',
    });
    // We intentionally only reset on OCR completion / id change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.ocrStatus, data?.id]);

  const save = useMutation({
    mutationFn: async ({ verified }: { verified: boolean }) => {
      const v = form.getValues();
      const consumed = v.consumedVolume.trim();
      return updateReading(id, {
        serialNumber: v.serialNumber.trim() || null,
        consumedVolume: consumed === '' ? null : Number(consumed.replace(',', '.')),
        technicianNote: v.technicianNote.trim() || null,
        verified,
      });
    },
    onSuccess: (next, variables) => {
      qc.setQueryData(['reading', id], next);
      // After confirming a reading, send the technician back to the gauge list
      // — that's the natural next-step in the flow (next gauge to read).
      if (variables.verified) {
        router.push('/gauges');
      }
    },
  });

  if (isLoading || !data) {
    return <p className="text-sm text-slate-600">{t('verify.ocrPending')}</p>;
  }

  const auxiliary = data.photos.filter((p) => p.id !== data.primaryPhotoId);
  const ocrPending = data.ocrStatus === 'pending';

  return (
    <div className="space-y-5">
      {data.primaryPhotoId && (
        <div className="overflow-hidden rounded-lg border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/photos/${data.primaryPhotoId}`}
            alt=""
            className="block w-full object-contain"
          />
        </div>
      )}

      {ocrPending && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t('verify.ocrPending')}
        </p>
      )}
      {data.ocrStatus === 'failed' && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {t('verify.ocrFailed')}
        </p>
      )}

      <fieldset className="space-y-4" disabled={ocrPending}>
        <div>
          <Label htmlFor="serialNumber">{t('verify.serialNumber')}</Label>
          <Input id="serialNumber" {...form.register('serialNumber')} />
        </div>
        <div>
          <Label htmlFor="consumedVolume">{t('verify.consumedVolume')}</Label>
          <Input id="consumedVolume" inputMode="decimal" {...form.register('consumedVolume')} />
        </div>
        <div>
          <Label htmlFor="technicianNote">{t('verify.technicianNote')}</Label>
          <Textarea id="technicianNote" rows={3} {...form.register('technicianNote')} />
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={() => save.mutate({ verified: false })}
          disabled={save.isPending || ocrPending}
        >
          {t('verify.save')}
        </Button>
        <Button
          onClick={() => save.mutate({ verified: true })}
          disabled={save.isPending || ocrPending}
        >
          {t('verify.saveAndConfirm')}
        </Button>
      </div>

      {save.isError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {t('errors.saveFailed')}
        </p>
      )}

      {data.verifiedAt && (
        <p className="text-sm text-emerald-700">
          {t('verify.verified', { date: new Date(data.verifiedAt).toLocaleString('de') })}
        </p>
      )}

      <AuxiliaryPhotos readingId={id} photos={auxiliary} />
    </div>
  );
}
