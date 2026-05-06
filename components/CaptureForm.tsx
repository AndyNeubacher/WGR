'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { createReading, HttpError } from '@/lib/api-client';
import { enqueueOffline } from '@/lib/offline-queue';

export function CaptureForm() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const gaugeId = searchParams.get('gaugeId') ?? undefined;

  // Revoke any outstanding object URL when the component unmounts — otherwise
  // a user picking a file then navigating away leaks the blob until tab close.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pick(picked: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
    setError(null);
    setQueuedOffline(false);
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setQueuedOffline(false);
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 2400,
        useWebWorker: true,
        fileType: 'image/jpeg',
      });
      try {
        const reading = await createReading(compressed, gaugeId);
        router.push(`/readings/${reading.id}`);
      } catch (err) {
        // HTTP errors (413/415/400/5xx) mean the server saw and rejected the
        // request — queueing won't help. Only fall back to the offline queue
        // for genuine network failures (fetch rejects with TypeError).
        if (err instanceof HttpError) {
          setError(t('errors.uploadFailed'));
          setUploading(false);
          return;
        }
        await enqueueOffline(compressed);
        setQueuedOffline(true);
        setTimeout(() => router.push('/readings'), 800);
      }
    } catch {
      setError(t('errors.uploadFailed'));
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {!previewUrl ? (
        <div className="grid grid-cols-1 gap-3">
          <Button size="lg" onClick={() => cameraRef.current?.click()}>
            {t('capture.takePhoto')}
          </Button>
          <Button size="lg" variant="outline" onClick={() => galleryRef.current?.click()}>
            {t('capture.fromGallery')}
          </Button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="" className="block w-full object-contain" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {queuedOffline && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t('capture.queuedOffline')}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={discard} disabled={uploading}>
              {t('capture.discard')}
            </Button>
            <Button onClick={upload} disabled={uploading}>
              {uploading ? t('capture.uploading') : t('capture.upload')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
