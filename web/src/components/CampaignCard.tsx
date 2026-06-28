"use client";

import { config, explorer } from "@/lib/config";
import type { CampaignView } from "@/lib/contract";
import {
  formatToken,
  formatTimeLeft,
  fromStroops,
  progressPercent,
  shortenAddress,
} from "@/lib/format";

interface CampaignCardProps {
  campaign: CampaignView;
  nowMs: number;
}

export interface CampaignStatus {
  ended: boolean;
  goalMet: boolean;
  label: string;
  tone: "active" | "success" | "failed" | "withdrawn";
}

export function deriveStatus(campaign: CampaignView, nowMs: number): CampaignStatus {
  const ended = nowMs >= campaign.deadline * 1000;
  const goalMet = campaign.totalRaised >= campaign.goal;
  if (campaign.withdrawn) {
    return { ended, goalMet, label: "Funded · withdrawn", tone: "withdrawn" };
  }
  if (!ended) return { ended, goalMet, label: "Active", tone: "active" };
  return goalMet
    ? { ended, goalMet, label: "Goal reached", tone: "success" }
    : { ended, goalMet, label: "Ended · goal missed", tone: "failed" };
}

const TONE_BADGE: Record<CampaignStatus["tone"], string> = {
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  success: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  failed: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  withdrawn: "border-slate-500/40 bg-slate-500/10 text-slate-300",
};

export function CampaignCard({ campaign, nowMs }: CampaignCardProps) {
  const pct = progressPercent(campaign.totalRaised, campaign.goal);
  const status = deriveStatus(campaign, nowMs);
  const deadlineDate = new Date(campaign.deadline * 1000);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Open Source Builders Fund</h2>
          <p className="mt-1 max-w-md text-sm text-slate-400">
            Help fund independent developers building public goods on Stellar. Every
            contribution is escrowed on-chain and refundable if the goal isn&apos;t met.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${TONE_BADGE[status.tone]}`}
        >
          {status.label}
        </span>
      </div>

      {/* Progress */}
      <div className="mt-6">
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold text-white">
            {formatToken(campaign.totalRaised)}
          </span>
          <span className="text-sm text-slate-400">
            of {fromStroops(campaign.goal)} {config.tokenSymbol} goal
          </span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-200">{pct.toFixed(1)}% funded</span>
          <span>
            {status.ended
              ? `Ended ${deadlineDate.toLocaleDateString()}`
              : formatTimeLeft(campaign.deadline, nowMs)}
          </span>
        </div>
      </div>

      {/* Meta */}
      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 text-sm">
        <Meta label="Beneficiary">
          <a
            href={explorer.account(campaign.admin)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-slate-200 hover:text-indigo-300"
          >
            {shortenAddress(campaign.admin)} ↗
          </a>
        </Meta>
        <Meta label="Deadline">
          <span className="text-slate-200">{deadlineDate.toLocaleString()}</span>
        </Meta>
        <Meta label="Token">
          <span className="text-slate-200">{config.tokenSymbol} (native)</span>
        </Meta>
        <Meta label="Contract">
          <a
            href={explorer.contract(config.contractId)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-slate-200 hover:text-indigo-300"
          >
            {shortenAddress(config.contractId)} ↗
          </a>
        </Meta>
      </dl>
    </section>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
