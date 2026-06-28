"use client";

import { useCallback, useEffect, useState } from "react";
import {
  connectWallet,
  disconnectWallet,
  getConnectedAddress,
  onWalletStateChange,
} from "@/lib/wallet";
import { mapError, type AppError } from "@/lib/errors";

export interface UseWallet {
  address: string | null;
  connecting: boolean;
  error: AppError | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
}

/**
 * Wallet connection state. Subscribes to the kit's STATE_UPDATED event so the
 * UI reflects connect / disconnect / account-switch from anywhere, and seeds
 * the initial address on mount.
 */
export function useWallet(): UseWallet {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    let mounted = true;
    getConnectedAddress().then((a) => {
      if (mounted && a) setAddress(a);
    });
    const unsubscribe = onWalletStateChange((a) => {
      if (mounted) setAddress(a);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const a = await connectWallet();
      setAddress(a);
    } catch (e) {
      const appError = mapError(e);
      // Don't nag the user if they simply closed the modal.
      if (appError.kind !== "wallet-rejected") setError(appError);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await disconnectWallet();
    } finally {
      setAddress(null);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { address, connecting, error, connect, disconnect, clearError };
}
