'use client';

import { useEffect, useRef, useState } from 'react';

interface PendingResponse {
  ok: boolean;
  pendingCount?: number;
  pendingIds?: string[];
}

const POLL_INTERVAL_MS = 30_000;

export function AdminNotificationWatcher({ initialPending, initialIds }: { initialPending: number; initialIds: string[] }) {
  const [pendingCount, setPendingCount] = useState(initialPending);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const knownIds = useRef<Set<string>>(new Set(initialIds));

  useEffect(() => {
    // Update favicon dot if pending > 0
    const link: HTMLLinkElement = document.querySelector("link[rel='icon']") ?? document.createElement('link');
    link.rel = 'icon';
    if (!link.parentNode) document.head.appendChild(link);

    const original = link.href;
    if (pendingCount > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0a0a0d';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#ff3b3b';
        ctx.beginPath();
        ctx.arc(16, 16, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = pendingCount > 9 ? '9+' : String(pendingCount);
        ctx.fillText(label, 16, 17);
        link.href = canvas.toDataURL('image/png');
      }
    }

    return () => {
      link.href = original;
    };
  }, [pendingCount]);

  useEffect(() => {
    const previousTitle = document.title;
    if (pendingCount > 0) {
      document.title = `(${pendingCount}) ${previousTitle.replace(/^\(\d+\)\s*/, '')}`;
    } else {
      document.title = previousTitle.replace(/^\(\d+\)\s*/, '');
    }
    return () => {
      document.title = previousTitle;
    };
  }, [pendingCount]);

  useEffect(() => {
    let cancelled = false;

    async function fetchPending() {
      try {
        const res = await fetch('/api/pending-count', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as PendingResponse;
        if (cancelled || !data.ok) return;

        const newIds = (data.pendingIds ?? []).filter((id) => !knownIds.current.has(id));
        (data.pendingIds ?? []).forEach((id) => knownIds.current.add(id));

        setPendingCount(data.pendingCount ?? 0);

        if (newIds.length > 0 && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('New THUG FPV submission', {
            body: `${newIds.length} new pending ${newIds.length === 1 ? 'entry' : 'entries'} ready for moderation.`,
            tag: 'thug-fpv-pending',
            requireInteraction: false
          });
        }
      } catch {
        // network errors are silent
      }
    }

    const interval = setInterval(fetchPending, POLL_INTERVAL_MS);
    // initial fetch on mount to sync immediately
    fetchPending();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function enableNotifications() {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      new Notification('THUG FPV admin notifications enabled', {
        body: 'You will be alerted when new submissions arrive while this tab is open.'
      });
    }
  }

  return (
    <div className="notif-bar">
      <div className="notif-status">
        {pendingCount > 0 ? (
          <span className="notif-dot" aria-label={`${pendingCount} pending`}>
            <span className="notif-pulse" />
            {pendingCount} pending submission{pendingCount === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="muted">No pending submissions. Auto-refreshing every {POLL_INTERVAL_MS / 1000}s.</span>
        )}
      </div>
      {permission === 'default' && (
        <button type="button" className="btn secondary notif-btn" onClick={enableNotifications}>
          Enable Browser Alerts
        </button>
      )}
      {permission === 'granted' && (
        <span className="tag tag-live">Browser alerts on</span>
      )}
      {permission === 'denied' && (
        <span className="tag tag-action">Browser alerts blocked in browser settings</span>
      )}
      {permission === 'unsupported' && (
        <span className="muted">Browser alerts unsupported on this device</span>
      )}
    </div>
  );
}
