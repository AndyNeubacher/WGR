'use client';
import { useEffect, useState } from 'react';
import { listOffline, replayOffline, subscribeQueue } from '@/lib/offline-queue';
import { t } from '@/lib/i18n';

export function QueueIndicator() {
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    setOnline(navigator.onLine);

    async function refresh() {
      const items = await listOffline();
      if (!mounted) return;
      setCount(items.length);
      setOnline(navigator.onLine);
    }

    refresh();
    const unsub = subscribeQueue(refresh);
    const onOnline = async () => {
      setOnline(true);
      await replayOffline();
      refresh();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if (navigator.onLine) replayOffline().then(refresh);

    return () => {
      mounted = false;
      unsub();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={
          online
            ? 'inline-block h-2 w-2 rounded-full bg-emerald-500'
            : 'inline-block h-2 w-2 rounded-full bg-amber-500'
        }
      />
      <span className="text-slate-600">
        {count > 0 ? t('queue.pending', { count }) : online ? t('queue.online') : t('queue.offline')}
      </span>
    </div>
  );
}
