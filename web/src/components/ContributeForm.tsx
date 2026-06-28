"use client";

import { useState } from "react";
import { config } from "@/lib/config";
import { contribute, type TxProgress } from "@/lib/contract";
import { mapError } from "@/lib/errors";
import { formatToken, toStroops } from "@/lib/format";
import { TxStatus } from "./TxStatus";

interface ContributeFormProps {
  address: string | null;
  ended: boolean;
  myContribution: bigint;
  onConnect: () => void;
  onSuccess: (hash: string, amountStroops: bigint) => void;
}

const PRESETS = ["5", "10", "25", "50"];

const IDLE: TxProgress = { phase: "idle" };

export function ContributeForm({
  address,
  ended,
  myContribution,
  onConnect,
  onSuccess,
}: ContributeFormProps) {
  const [amount, setAmount] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [progress, setProgress] = useState<TxProgress>(IDLE);

  const busy = ["building", "signing", "pending"].includes(progress.phase);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address || ended || busy) return;

    let stroops: bigint;
    try {
      stroops = toStroops(amount);
      if (stroops <= 0n) throw new Error("Enter an amount greater than zero.");
    } catch (err) {
      setInputError(err instanceof Error ? err.message : "Invalid amount");
      return;
    }
    setInputError(null);

    try {
      const { hash } = await contribute(address, stroops, setProgress);
      onSuccess(hash, stroops);
      setAmount("");
      // Auto-clear the success panel after a moment.
      setTimeout(() => setProgress(IDLE), 8000);
    } catch (err) {
      // contribute() already pushed an "error" progress; ensure state is set.
      setProgress({ phase: "error", error: mapError(err) });
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Contribute</h3>
        {myContribution > 0n && (
          <span className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-300">
            You: {formatToken(myContribution)}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4">
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
          Amount
        </label>
        <div className="mt-1.5 flex items-center rounded-xl border border-slate-700 bg-slate-950/60 focus-within:border-indigo-500">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setInputError(null);
            }}
            placeholder="0.0"
            disabled={ended || busy}
            className="w-full bg-transparent px-4 py-3 text-lg text-white outline-none placeholder:text-slate-600 disabled:opacity-60"
          />
          <span className="px-4 text-sm font-semibold text-slate-400">{config.tokenSymbol}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={ended || busy}
              onClick={() => {
                setAmount(p);
                setInputError(null);
              }}
              className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-indigo-500 hover:text-white disabled:opacity-50"
            >
              {p} {config.tokenSymbol}
            </button>
          ))}
        </div>

        {inputError && <p className="mt-2 text-xs text-rose-400">{inputError}</p>}

        <div className="mt-4">
          {!address ? (
            <button
              type="button"
              onClick={onConnect}
              className="w-full rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
            >
              Connect wallet to contribute
            </button>
          ) : ended ? (
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-500"
            >
              Campaign ended
            </button>
          ) : (
            <button
              type="submit"
              disabled={busy || amount.trim() === ""}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Processing…" : `Contribute ${config.tokenSymbol}`}
            </button>
          )}
        </div>
      </form>

      <TxStatus progress={progress} />
    </section>
  );
}
