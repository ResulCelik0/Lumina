"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchEventsSince, fetchRecentEvents, type CampaignEvent } from "@/lib/events";

const POLL_MS = 6_000;
const MAX_EVENTS = 60;

export interface UseContractEvents {
  events: CampaignEvent[];
  streaming: boolean;
}

/**
 * Streams contract events via RPC polling. Backfills a recent window on mount,
 * then pages forward from the cursor every few seconds. `onNew` fires with any
 * freshly-seen events so the page can react (toast + state refresh).
 */
export function useContractEvents(
  onNew?: (events: CampaignEvent[]) => void,
): UseContractEvents {
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const onNewRef = useRef(onNew);
  useEffect(() => {
    onNewRef.current = onNew;
  }, [onNew]);

  const merge = useCallback((incoming: CampaignEvent[], isBackfill: boolean) => {
    const fresh = incoming.filter((e) => !seenRef.current.has(e.id));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seenRef.current.add(e.id));
    // RPC returns oldest-first; the feed shows newest-first.
    const newestFirst = [...fresh].reverse();
    setEvents((prev) => [...newestFirst, ...prev].slice(0, MAX_EVENTS));
    if (!isBackfill) onNewRef.current?.(fresh);
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let first = true;

    async function tick() {
      try {
        const page = cursorRef.current
          ? await fetchEventsSince(cursorRef.current)
          : await fetchRecentEvents();
        if (!active) return;
        cursorRef.current = page.cursor;
        merge(page.events, first);
        setStreaming(true);
      } catch {
        if (active) setStreaming(false);
      } finally {
        first = false;
        if (active) timer = setTimeout(tick, POLL_MS);
      }
    }

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [merge]);

  return { events, streaming };
}
