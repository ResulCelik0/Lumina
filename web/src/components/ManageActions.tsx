"use client";

import { useState } from "react";
import type { CampaignView } from "@/lib/contract";
import { refund, withdraw, type TxProgress } from "@/lib/contract";
import { mapError } from "@/lib/errors";
import { formatToken } from "@/lib/format";
import type { CampaignStatus } from "./CampaignCard";
import { TxStatus } from "./TxStatus";

interface ManageActionsProps {
  address: string | null;
  campaign: CampaignView;
  status: CampaignStatus;
  myContribution: bigint;
  onSuccess: (kind: "withdraw" | "refund", hash: string) => void;
}

const IDLE: TxProgress = { phase: "idle" };

export function ManageActions({
  address,
  campaign,
  status,
  myContribution,
  onSuccess,
}: ManageActionsProps) {
  const [progress, setProgress] = useState<TxProgress>(IDLE);
  const busy = ["building", "signing", "pending"].includes(progress.phase);

  if (!address) return null;

  const isAdmin = address === campaign.admin;
  const canWithdraw = isAdmin && status.ended && status.goalMet && !campaign.withdrawn;
  const canRefund = status.ended && !status.goalMet && myContribution > 0n;

  if (!canWithdraw && !canRefund) return null;

  async function run(action: "withdraw" | "refund") {
    if (!address || busy) return;
    try {
      const fn = action === "withdraw" ? withdraw : refund;
      const { hash } = await fn(address, setProgress);
      onSuccess(action, hash);
      setTimeout(() => setProgress(IDLE), 8000);
    } catch (err) {
      setProgress({ phase: "error", error: mapError(err) });
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
      <h3 className="text-lg font-semibold text-white">Manage</h3>

      {canWithdraw && (
        <div className="mt-3">
          <p className="text-sm text-slate-400">
            The goal was reached. As the beneficiary, you can withdraw the raised{" "}
            <span className="font-semibold text-slate-200">
              {formatToken(campaign.totalRaised)}
            </span>
            .
          </p>
          <button
            onClick={() => run("withdraw")}
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {busy ? "Processing…" : "Withdraw funds"}
          </button>
        </div>
      )}

      {canRefund && (
        <div className="mt-3">
          <p className="text-sm text-slate-400">
            The campaign ended without reaching its goal. You can reclaim your{" "}
            <span className="font-semibold text-slate-200">{formatToken(myContribution)}</span>.
          </p>
          <button
            onClick={() => run("refund")}
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-50"
          >
            {busy ? "Processing…" : "Claim refund"}
          </button>
        </div>
      )}

      <TxStatus progress={progress} />
    </section>
  );
}
