"use client";

import { explorer } from "@/lib/config";
import type { CampaignEvent, CampaignEventType } from "@/lib/events";
import { formatToken, shortenAddress, shortenHash, timeAgo } from "@/lib/format";

interface ActivityFeedProps {
  events: CampaignEvent[];
  streaming: boolean;
  nowMs: number;
}

const EVENT_META: Record<CampaignEventType, { icon: string; label: string; color: string }> = {
  contribute: { icon: "↑", label: "Contribution", color: "text-emerald-300" },
  withdraw: { icon: "↓", label: "Withdrawal", color: "text-indigo-300" },
  refund: { icon: "↩", label: "Refund", color: "text-rose-300" },
  initialized: { icon: "✦", label: "Campaign created", color: "text-sky-300" },
  unknown: { icon: "•", label: "Event", color: "text-slate-300" },
};

export function ActivityFeed({ events, streaming, nowMs }: ActivityFeedProps) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Live activity</h3>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              streaming ? "animate-pulse bg-emerald-400" : "bg-slate-600"
            }`}
          />
          <span className={streaming ? "text-emerald-300" : "text-slate-500"}>
            {streaming ? "Streaming" : "Reconnecting…"}
          </span>
        </span>
      </div>

      <p className="mt-1 text-xs text-slate-500">
        On-chain contract events, polled from Soroban RPC in real time.
      </p>

      <ul className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
        {events.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
            No events yet. Be the first to contribute!
          </li>
        )}
        {events.map((e) => {
          const meta = EVENT_META[e.type] ?? EVENT_META.unknown;
          return (
            <li
              key={e.id}
              className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3.5 py-3 animate-[slidein_0.25s_ease-out]"
            >
              <span className={`mt-0.5 text-base font-bold ${meta.color}`}>{meta.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-200">{meta.label}</span>
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {timeAgo(e.ledgerClosedAt, nowMs)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                  {e.who && <span className="font-mono">{shortenAddress(e.who)}</span>}
                  {e.amount != null && (
                    <span className={`font-semibold ${meta.color}`}>
                      {formatToken(e.amount)}
                    </span>
                  )}
                  {e.type === "contribute" && e.total != null && (
                    <span className="text-slate-500">· total {formatToken(e.total)}</span>
                  )}
                </div>
                <a
                  href={explorer.tx(e.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-mono text-[11px] text-indigo-400/80 hover:text-indigo-300"
                >
                  {shortenHash(e.txHash)} ↗
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
