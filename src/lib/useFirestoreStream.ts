/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * EXTRABLACK SNOOKER MANAGER - Real-time Broadcast & Synchronization Hook
 */

import { useEffect, useRef } from 'react';

/**
 * Subscribes to real-time live updates on games, tables, sessions, and waiting list.
 * Automatically triggers callback on any database mutation or table change from any client/tab.
 */
export function useFirestoreRealtimeStream(onRemoteChange: () => void) {
  const onChangeRef = useRef(onRemoteChange);
  onChangeRef.current = onRemoteChange;

  useEffect(() => {
    let isMounted = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let eventSource: EventSource | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    const notifyChange = () => {
      if (!isMounted) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isMounted) {
          onChangeRef.current();
        }
      }, 100);
    };

    // 1. Establish SSE real-time connection to Express backend
    try {
      if (typeof window !== 'undefined' && typeof window.EventSource !== 'undefined') {
        eventSource = new EventSource('/api/dashboard/stream');
        eventSource.onmessage = event => {
          if (event.data && event.data.trim() && !event.data.startsWith(':')) {
            notifyChange();
          }
        };
        eventSource.onerror = () => {
          // SSE reconnects automatically
        };
      }
    } catch (err) {
      console.warn('[RealtimeStream] EventSource notice:', err);
    }

    // 2. Periodic sync pulse as background safety net
    fallbackInterval = setInterval(() => {
      if (isMounted) {
        notifyChange();
      }
    }, 10000);

    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (eventSource) {
        try {
          eventSource.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);
}

