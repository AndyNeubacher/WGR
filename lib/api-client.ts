import type { ReadingDto, PhotoDto } from '@/lib/dto';

export type { ReadingDto, PhotoDto };

// Thrown when the server responded with a non-2xx — the request reached the
// server, so retrying offline won't help. Callers use this to skip the offline
// queue (which is only useful for genuine network failures).
export class HttpError extends Error {
  status: number;
  constructor(status: number, message?: string) {
    super(message ?? `HTTP ${status}`);
    this.status = status;
  }
}

export async function fetchReading(id: string): Promise<ReadingDto> {
  const res = await fetch(`/api/readings/${id}`);
  if (!res.ok) throw new HttpError(res.status, `Failed to fetch reading: ${res.status}`);
  return res.json();
}

export async function fetchReadings(): Promise<ReadingDto[]> {
  const res = await fetch('/api/readings');
  if (!res.ok) throw new HttpError(res.status, `Failed to fetch readings: ${res.status}`);
  return res.json();
}

export async function createReading(file: File, gaugeId?: string): Promise<ReadingDto> {
  const fd = new FormData();
  fd.append('file', file);
  const url = gaugeId ? `/api/readings?gaugeId=${encodeURIComponent(gaugeId)}` : '/api/readings';
  const res = await fetch(url, { method: 'POST', body: fd });
  if (!res.ok) throw new HttpError(res.status, `Upload failed: ${res.status}`);
  return res.json();
}

export async function updateReading(
  id: string,
  body: {
    serialNumber?: string | null;
    consumedVolume?: number | null;
    technicianNote?: string | null;
    verified?: boolean;
  },
): Promise<ReadingDto> {
  const res = await fetch(`/api/readings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new HttpError(res.status, `Update failed: ${res.status}`);
  return res.json();
}

export async function addAuxiliaryPhoto(
  readingId: string,
  file: File,
  caption?: string,
): Promise<PhotoDto> {
  const fd = new FormData();
  fd.append('file', file);
  if (caption) fd.append('caption', caption);
  const res = await fetch(`/api/readings/${readingId}/photos`, { method: 'POST', body: fd });
  if (!res.ok) throw new HttpError(res.status, `Auxiliary upload failed: ${res.status}`);
  return res.json();
}

export async function deletePhoto(readingId: string, photoId: string): Promise<void> {
  const res = await fetch(`/api/readings/${readingId}/photos/${photoId}`, { method: 'DELETE' });
  if (!res.ok) throw new HttpError(res.status, `Delete failed: ${res.status}`);
}
