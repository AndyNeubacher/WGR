import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const STORAGE_ROOT = process.env.STORAGE_ROOT
  ? path.resolve(process.env.STORAGE_ROOT)
  : path.join(process.cwd(), 'storage');

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

/** Hard ceiling on stored bytes — generously above the client's 2 MB target. */
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

export class InvalidUploadError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function savePhoto(
  file: File,
): Promise<{ path: string; absolutePath: string }> {
  if (file.size === 0) {
    throw new InvalidUploadError('empty file');
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new InvalidUploadError('file too large', 413);
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new InvalidUploadError(`unsupported file type: ${file.type || 'unknown'}`, 415);
  }

  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dir = path.join(STORAGE_ROOT, yyyy, mm);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${extFromMime(file.type)}`;
  const relPath = path.posix.join(yyyy, mm, filename);
  const absPath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buffer);
  return { path: relPath, absolutePath: absPath };
}

/**
 * Resolve a stored relative path to an absolute path inside STORAGE_ROOT.
 * Throws if the resolved path escapes the root — defence in depth against
 * malformed paths leaking through the DB layer.
 */
export function resolvePhotoPath(relPath: string): string {
  const normalised = path.posix.normalize(relPath).replace(/^([./\\])+/, '');
  const abs = path.resolve(STORAGE_ROOT, normalised);
  const rootWithSep = STORAGE_ROOT.endsWith(path.sep) ? STORAGE_ROOT : STORAGE_ROOT + path.sep;
  if (abs !== STORAGE_ROOT && !abs.startsWith(rootWithSep)) {
    throw new Error(`Invalid photo path: ${relPath}`);
  }
  return abs;
}

export async function readPhoto(
  relPath: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const abs = resolvePhotoPath(relPath);
  const buffer = await fs.readFile(abs);
  const ext = path.extname(abs).slice(1).toLowerCase();
  return { buffer, contentType: mimeForExt(ext) };
}

export async function deletePhotoFile(relPath: string): Promise<void> {
  try {
    await fs.unlink(resolvePhotoPath(relPath));
  } catch {
    // best effort — file may already be gone, or the path may be invalid.
  }
}

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return 'bin';
  }
}

function mimeForExt(ext: string): string {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    default:
      return 'application/octet-stream';
  }
}
