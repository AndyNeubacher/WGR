import type { Photo, Reading, User, Customer, Site, Gauge } from '@prisma/client';

type ReadingWithRelations = Reading & {
  photos: Photo[];
  primaryPhoto: Photo | null;
};

export type PhotoDto = {
  id: string;
  caption: string | null;
  createdAt: string;
};

export type NoteDto = {
  id: string;
  targetType: string;
  targetId: string;
  body: string;
  authorId: string;
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
  gaugeId: string | null;
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
    gaugeId: r.gaugeId,
    photos: r.photos.map((p) => ({
      id: p.id,
      caption: p.caption,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

export type UserDto = {
  id: string;
  name: string;
  email: string;
  role: 'technician' | 'manager';
  createdAt: string;
};

export function userToDto(u: User): UserDto {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

export type CustomerDto = {
  id: string;
  name: string;
  createdAt: string;
};

export function customerToDto(c: Customer): CustomerDto {
  return {
    id: c.id,
    name: c.name,
    createdAt: c.createdAt.toISOString(),
  };
}

export type SiteDto = {
  id: string;
  customerId: string;
  customerName?: string;
  name: string;
  address: string | null;
  createdAt: string;
};

export function siteToDto(s: Site & { customer?: Customer }): SiteDto {
  return {
    id: s.id,
    customerId: s.customerId,
    customerName: s.customer?.name,
    name: s.name,
    address: s.address,
    createdAt: s.createdAt.toISOString(),
  };
}

export type GaugeDto = {
  id: string;
  siteId: string;
  siteName?: string;
  customerName?: string;
  label: string;
  createdAt: string;
};

export function gaugeToDto(g: Gauge & { site?: Site & { customer?: Customer } }): GaugeDto {
  return {
    id: g.id,
    siteId: g.siteId,
    siteName: g.site?.name,
    customerName: g.site?.customer?.name,
    label: g.label,
    createdAt: g.createdAt.toISOString(),
  };
}
