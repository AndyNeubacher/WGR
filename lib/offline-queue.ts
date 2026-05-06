'use client';
import { openDB, type IDBPDatabase } from 'idb';

type QueueItem = {
  id: string;
  blob: Blob;
  filename: string;
  createdAt: number;
  attempts: number;
};

const DB_NAME = 'wgr-offline';
const STORE = 'uploads';
const CHANGE_EVENT = 'wgr-offline-queue-change';

let dbPromise: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueOffline(file: File): Promise<void> {
  const d = await db();
  await d.put(STORE, {
    id: crypto.randomUUID(),
    blob: file,
    filename: file.name || 'photo.jpg',
    createdAt: Date.now(),
    attempts: 0,
  } satisfies QueueItem);
  notifyChange();
}

export async function listOffline(): Promise<QueueItem[]> {
  const d = await db();
  return d.getAll(STORE);
}

async function deleteOffline(id: string): Promise<void> {
  const d = await db();
  await d.delete(STORE, id);
  notifyChange();
}

async function bumpAttempts(item: QueueItem): Promise<void> {
  const d = await db();
  await d.put(STORE, { ...item, attempts: item.attempts + 1 });
}

export async function replayOffline(): Promise<{ ok: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: 0, failed: 0 };
  }
  const items = await listOffline();
  let ok = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const fd = new FormData();
      fd.append(
        'file',
        new File([item.blob], item.filename, {
          type: item.blob.type || 'image/jpeg',
        }),
      );
      const res = await fetch('/api/readings', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(String(res.status));
      await deleteOffline(item.id);
      ok++;
    } catch {
      await bumpAttempts(item);
      failed++;
    }
  }
  if (ok > 0) notifyChange();
  return { ok, failed };
}

function notifyChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

export function subscribeQueue(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const wrap = () => handler();
  window.addEventListener(CHANGE_EVENT, wrap);
  return () => window.removeEventListener(CHANGE_EVENT, wrap);
}
