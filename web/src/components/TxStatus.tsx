"use client";

import { explorer } from "@/lib/config";
import type { TxProgress } from "@/lib/contract";
import { shortenHash } from "@/lib/format";

const PHASE_COPY: Record<TxProgress["phase"], { label: string; tone: string }> = {
  idle: { label: "", tone: "" },
  building: { label: "Simulating transaction…", tone: "text-sky-300" },
  signing: { label: "Waiting for wallet signature…", tone: "text-amber-300" },
  pending: { label: "Submitting to network — pending…", tone: "text-amber-300" },
  success: { label: "Transaction confirmed", tone: "text-emerald-300" },
  error: { label: "Transaction failed", tone: "text-rose-300" },
};

export function TxStatus({ progress }: { progress: TxProgress }) {
  if (progress.phase === "idle") return null;
  const { label, tone } = PHASE_COPY[progress.phase];
  const busy = ["building", "signing", "pending"].includes(progress.phase);

  return (
    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
      <div className="flex items-center gap-2">
        {busy && <Spinner />}
        {progress.phase === "success" && <span className="text-emerald-400">✓</span>}
        {progress.phase === "error" && <span className="text-rose-400">✕</span>}
        <span className={`font-medium ${tone}`}>
          {progress.phase === "error" && progress.error
            ? progress.error.title
            : label}
        </span>
      </div>

      {progress.phase === "error" && progress.error && (
        <p className="mt-1 text-xs text-slate-400">{progress.error.message}</p>
      )}

      {progress.hash && (
        <a
          href={explorer.tx(progress.hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block font-mono text-xs text-indigo-300 hover:text-indigo-200"
        >
          {shortenHash(progress.hash, 8)} — view on Explorer ↗
        </a>
      )}

      {/* Phase timeline */}
      {progress.phase !== "error" && (
        <ol className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
          <Step active={progress.phase === "building"} done={["signing", "pending", "success"].includes(progress.phase)}>
            Simulate
          </Step>
          <Sep />
          <Step active={progress.phase === "signing"} done={["pending", "success"].includes(progress.phase)}>
            Sign
          </Step>
          <Sep />
          <Step active={progress.phase === "pending"} done={progress.phase === "success"}>
            Submit
          </Step>
          <Sep />
          <Step active={false} done={progress.phase === "success"}>
            Confirmed
          </Step>
        </ol>
      )}
    </div>
  );
}

function Step({
  active,
  done,
  children,
}: {
  active: boolean;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={`rounded px-1.5 py-0.5 ${
        done
          ? "bg-emerald-500/15 text-emerald-300"
          : active
            ? "bg-amber-500/15 text-amber-300"
            : "bg-slate-800/60"
      }`}
    >
      {children}
    </li>
  );
}

function Sep() {
  return <span className="text-slate-700">→</span>;
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-slate-300" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" className="opacity-90" />
    </svg>
  );
}
