"use client";

import { useState } from "react";
import { explorer } from "@/lib/config";
import { shortenAddress } from "@/lib/format";
import { SUPPORTED_WALLETS } from "@/lib/wallet";

interface WalletButtonProps {
  address: string | null;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletButton({ address, connecting, onConnect, onDisconnect }: WalletButtonProps) {
  const [open, setOpen] = useState(false);

  if (!address) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={onConnect}
          disabled={connecting}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {connecting ? (
            <>
              <Spinner /> Connecting…
            </>
          ) : (
            <>
              <WalletIcon /> Connect Wallet
            </>
          )}
        </button>
        <span className="hidden text-[11px] text-slate-500 sm:block">
          {SUPPORTED_WALLETS.join(" · ")}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm font-medium text-slate-100 transition hover:border-slate-600"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="font-mono">{shortenAddress(address)}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" className="opacity-60">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
            <div className="border-b border-slate-800 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Connected</p>
              <p className="mt-0.5 break-all font-mono text-xs text-slate-200">{address}</p>
            </div>
            <a
              href={explorer.account(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800"
            >
              View on Explorer ↗
            </a>
            <button
              onClick={() => {
                setOpen(false);
                onDisconnect();
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-rose-300 transition hover:bg-slate-800"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" className="opacity-90" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 12h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
