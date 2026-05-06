import type { Photo, Reading } from '@prisma/client';

type ReadingWithRelations = Reading & {
  photos: Photo[];
  primaryPhoto: Photo | null;
};

export type PhotoDto = {
  id: string;
  caption: string | null;
  createdAt: string;
};

export type ReadingDto = {
  id: string;
  primaryPhotoId: string | null;
  serialNumber: string | null;
  consumedVolume: string | null;
  ocrStatus: 'pending' | 'done' | 'failed';
  technicianNote: string | null;
  createdAt: string;
  verifiedAt: string | null;
  photos: PhotoDto[];
};

export function readingToDto(r: ReadingWithRelations): ReadingDto {
  return {
    id: r.id,
    primaryPhotoId: r.primaryPhotoId,
    serialNumber: r.serialNumber,
    consumedVolume: r.consumedVolume?.toString() ?? null,
    ocrStatus: r.ocrStatus,
    technicianNote: r.technicianNote,
    createdAt: r.createdAt.toISOString(),
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    photos: r.photos.map((p) => ({
      id: p.id,
      caption: p.caption,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}
