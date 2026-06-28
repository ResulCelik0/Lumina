"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCampaign, fetchContribution, type CampaignView } from "@/lib/contract";

const POLL_MS = 10_000;

export interface UseCampaign {
  campaign: CampaignView | null;
  myContribution: bigint;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Reads campaign state from the contract and keeps it fresh by polling, plus an
 * imperative `refresh()` the UI calls right after a write or a new live event
 * (state synchronization).
 */
export function useCampaign(address: string | null): UseCampaign {
  const [campaign, setCampaign] = useState<CampaignView | null>(null);
  const [myContribution, setMyContribution] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const c = await fetchCampaign();
      setCampaign(c);
      setError(null);
      if (address) {
        setMyContribution(await fetchContribution(address));
      } else {
        setMyContribution(0n);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load campaign");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    let cancelled = false;
    // Initial load inline so state updates happen *after* the awaited fetch
    // (avoids synchronous setState in the effect body).
    (async () => {
      try {
        const c = await fetchCampaign();
        const mine = address ? await fetchContribution(address) : 0n;
        if (cancelled) return;
        setCampaign(c);
        setMyContribution(mine);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load campaign");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, refresh]);

  return { campaign, myContribution, loading, error, refresh };
}
