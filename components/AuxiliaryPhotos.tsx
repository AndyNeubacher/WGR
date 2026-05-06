'use client';
import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
import { addAuxiliaryPhoto, deletePhoto, fetchReading } from '@/lib/api-client';
import { t } from '@/lib/i18n';

type Props = {
  readingId: string;
  photos: Array<{ id: string; caption: string | null; createdAt: string }>;
};

export function AuxiliaryPhotos({ readingId, photos }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const refresh = async () => {
    const next = await fetchReading(readingId);
    qc.setQueryData(['reading', readingId], next);
  };

  const add = useMutation({
    mutationFn: async (file: File) => {
      const compressed = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 2400,
        useWebWorker: true,
        fileType: 'image/jpeg',
      });
      await addAuxiliaryPhoto(readingId, compressed);
    },
    onSuccess: refresh,
  });

  const del = useMutation({
    mutationFn: (photoId: string) => deletePhoto(readingId, photoId),
    onSuccess: refresh,
  });

  return (
    <section className="space-y-3 border-t pt-4">
      <header>
        <h2 className="text-base font-semibold">{t('verify.auxiliaryPhotos')}</h2>
        <p className="text-xs text-slate-500">{t('verify.addAuxiliaryHint')}</p>
      </header>

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <li key={p.id} className="relative overflow-hidden rounded-md border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/${p.id}`}
                alt=""
                className="block aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={() => del.mutate(p.id)}
                disabled={del.isPending}
                className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white"
              >
                {t('common.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={add.isPending}>
        {t('verify.addAuxiliary')}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) add.mutate(f);
          e.target.value = '';
        }}
      />

      {add.isError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {t('errors.uploadFailed')}
        </p>
      )}
      {del.isError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {t('errors.deleteFailed')}
        </p>
      )}
    </section>
  );
}
