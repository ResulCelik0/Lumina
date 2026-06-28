"use client";

import { useCallback, useEffect, useState } from "react";
import { config, explorer } from "@/lib/config";
import type { CampaignEvent } from "@/lib/events";
import { formatToken, shortenAddress } from "@/lib/format";
import { useCampaign } from "@/hooks/useCampaign";
import { useContractEvents } from "@/hooks/useContractEvents";
import { useWallet } from "@/hooks/useWallet";
import { ActivityFeed } from "./ActivityFeed";
import { CampaignCard, deriveStatus } from "./CampaignCard";
import { ContributeForm } from "./ContributeForm";
import { ManageActions } from "./ManageActions";
import { useToast } from "./Toast";
import { WalletButton } from "./WalletButton";

export function Dashboard() {
  const wallet = useWallet();
  const { push } = useToast();
  const { campaign, myContribution, loading, error, refresh } = useCampaign(wallet.address);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Real-time events → toast notifications + state synchronization.
  const onNewEvents = useCallback(
    (fresh: CampaignEvent[]) => {
      for (const e of fresh) {
        if (e.type === "contribute" && e.amount != null) {
          push({
            tone: "success",
            title: "New contribution",
            message: `${shortenAddress(e.who)} gave ${formatToken(e.amount)}`,
          });
        } else if (e.type === "withdraw" && e.amount != null) {
          push({ tone: "info", title: "Funds withdrawn", message: formatToken(e.amount) });
        } else if (e.type === "refund" && e.amount != null) {
          push({ tone: "info", title: "Refund claimed", message: formatToken(e.amount) });
        }
      }
      // Sync on-chain state after any event.
      refresh();
    },
    [push, refresh],
  );

  const { events, streaming } = useContractEvents(onNewEvents);

  // Surface wallet errors as toasts.
  const { error: walletError, clearError } = wallet;
  useEffect(() => {
    if (walletError) {
      push({ tone: "error", title: walletError.title, message: walletError.message });
      clearError();
    }
  }, [walletError, clearError, push]);

  const status = campaign ? deriveStatus(campaign, nowMs) : null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/70 bg-slate-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-lg font-black text-slate-950">
              ◎
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-white">StellarFund</p>
              <p className="text-[11px] leading-tight text-slate-500">
                Soroban crowdfunding · Testnet
              </p>
            </div>
          </div>
          <WalletButton
            address={wallet.address}
            connecting={wallet.connecting}
            onConnect={wallet.connect}
            onDisconnect={wallet.disconnect}
          />
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {loading && !campaign ? (
          <LoadingState />
        ) : error && !campaign ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : campaign && status ? (
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-6">
              <CampaignCard campaign={campaign} nowMs={nowMs} />
              <ContributeForm
                address={wallet.address}
                ended={status.ended}
                myContribution={myContribution}
                onConnect={wallet.connect}
                onSuccess={(hash, amount) => {
                  push({
                    tone: "success",
                    title: "Contribution confirmed",
                    message: (
                      <a
                        href={explorer.tx(hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {formatToken(amount)} — view transaction ↗
                      </a>
                    ),
                  });
                  refresh();
                }}
              />
              <ManageActions
                address={wallet.address}
                campaign={campaign}
                status={status}
                myContribution={myContribution}
                onSuccess={(kind, hash) => {
                  push({
                    tone: "success",
                    title: kind === "withdraw" ? "Withdrawal confirmed" : "Refund confirmed",
                    message: (
                      <a
                        href={explorer.tx(hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        View transaction ↗
                      </a>
                    ),
                  });
                  refresh();
                }}
              />
            </div>

            <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
              <ActivityFeed events={events} streaming={streaming} nowMs={nowMs} />
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-slate-500 sm:px-6">
        <div className="flex flex-col gap-2 border-t border-slate-800/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Network: <span className="text-slate-400">Stellar Testnet</span> · Contract:{" "}
            <a
              href={explorer.contract(config.contractId)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-slate-400 hover:text-indigo-300"
            >
              {shortenAddress(config.contractId, 6)} ↗
            </a>
          </span>
          <span>Built on Soroban · StellarWalletsKit</span>
        </div>
      </footer>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <div className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/40" />
        <div className="h-56 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/40" />
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/40" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
      <p className="text-lg font-semibold text-rose-200">Couldn&apos;t load the campaign</p>
      <p className="mt-2 text-sm text-slate-400">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
      >
        Retry
      </button>
    </div>
  );
}
