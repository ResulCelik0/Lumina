/**
 * Error normalisation layer.
 *
 * Wallet SDKs, the Soroban RPC, and the contract itself all throw very
 * differently-shaped errors. This module funnels every failure into a small
 * set of user-facing {@link AppError}s so the UI can render a clear, actionable
 * message instead of a raw stack trace.
 *
 * The three headline categories required by the brief — wallet not found,
 * user rejected, and insufficient balance — are detected explicitly, alongside
 * every on-chain contract error code emitted by the Soroban contract.
 */

import { Errors } from "@/contracts/crowdfunding";
import { config } from "./config";

export type AppErrorKind =
  | "wallet-not-found"
  | "wallet-rejected"
  | "insufficient-balance"
  | "deadline"
  | "contract"
  | "network"
  | "unknown";

export interface AppError {
  kind: AppErrorKind;
  title: string;
  message: string;
  /** Original error, kept for console diagnostics. */
  cause?: unknown;
}

/** Friendly, contextual copy for each on-chain contract error code. */
const CONTRACT_ERROR_COPY: Record<number, { title: string; message: string; kind: AppErrorKind }> = {
  1: { kind: "contract", title: "Already initialized", message: "This campaign has already been created." },
  2: { kind: "contract", title: "Not initialized", message: "The campaign has not been initialized yet." },
  3: { kind: "contract", title: "Invalid amount", message: "Enter an amount greater than zero." },
  4: { kind: "contract", title: "Invalid deadline", message: "The deadline must be in the future." },
  5: { kind: "deadline", title: "Campaign ended", message: "This campaign has ended — contributions are now closed." },
  6: { kind: "deadline", title: "Campaign still running", message: "This action is only available after the deadline." },
  7: { kind: "contract", title: "Goal not reached", message: "The funding goal wasn't reached, so funds can't be withdrawn." },
  8: { kind: "contract", title: "Goal reached", message: "The goal was reached — contributions are no longer refundable." },
  9: { kind: "contract", title: "Nothing to refund", message: "This account has no contribution to reclaim." },
  10: { kind: "contract", title: "Already withdrawn", message: "The campaign funds have already been withdrawn." },
  11: { kind: "contract", title: "Math overflow", message: "The amount is too large to process." },
};

/** Reverse lookup: lowercased variant name -> error code (from the bindings). */
const NAME_TO_CODE: Record<string, number> = Object.fromEntries(
  Object.entries(Errors as Record<number, { message: string }>).map(([code, { message }]) => [
    message.toLowerCase(),
    Number(code),
  ]),
);

function asText(error: unknown): string {
  if (error == null) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Map any thrown value to a structured, user-facing error. */
export function mapError(error: unknown): AppError {
  const raw = asText(error);
  const text = raw.toLowerCase();

  // 1) User explicitly rejected the request in their wallet.
  if (
    /reject|declined|denied|cancel|user closed|request was rejected|action_rejected/.test(text)
  ) {
    return {
      kind: "wallet-rejected",
      title: "Request rejected",
      message: "You declined the request in your wallet. No transaction was sent.",
      cause: error,
    };
  }

  // 2) Wallet missing / not installed / unavailable.
  if (
    /not installed|not found|no wallet|unavailable|is not available|could not find|extension/.test(
      text,
    )
  ) {
    return {
      kind: "wallet-not-found",
      title: "Wallet not available",
      message:
        "We couldn't reach the selected wallet. Make sure the extension is installed, unlocked, and set to Testnet.",
      cause: error,
    };
  }

  // 3) Insufficient balance / missing trustline (raised by the token contract).
  //    Checked before generic contract-code mapping to avoid colliding with our
  //    own error codes.
  if (/insufficient|not enough|balance is|underflow|trustline|trust line/.test(text)) {
    return {
      kind: "insufficient-balance",
      title: "Insufficient balance",
      message: `Your account doesn't have enough ${config.tokenSymbol} to complete this contribution.`,
      cause: error,
    };
  }

  // 4a) On-chain contract error by code: extract `Error(Contract, #N)`.
  const codeMatch = raw.match(/Error\(Contract,\s*#(\d+)\)/);
  if (codeMatch) {
    const code = Number(codeMatch[1]);
    const copy = CONTRACT_ERROR_COPY[code];
    if (copy) return { ...copy, cause: error };
    const known = (Errors as Record<number, { message: string }>)[code];
    if (known) {
      return { kind: "contract", title: "Contract error", message: known.message, cause: error };
    }
  }

  // 4b) On-chain contract error by name: the typed bindings surface a
  //     `Result.Err` whose message is the variant name, e.g. "DeadlinePassed".
  for (const [name, code] of Object.entries(NAME_TO_CODE)) {
    if (text.includes(name)) {
      const copy = CONTRACT_ERROR_COPY[code];
      if (copy) return { ...copy, cause: error };
    }
  }

  // 5) Network / RPC connectivity problems.
  if (/failed to fetch|network|timeout|timed out|fetch failed|econn|503|502|gateway/.test(text)) {
    return {
      kind: "network",
      title: "Network error",
      message: "Couldn't reach the Stellar network. Check your connection and try again.",
      cause: error,
    };
  }

  // 6) Anything else.
  return {
    kind: "unknown",
    title: "Something went wrong",
    message: raw ? raw.slice(0, 200) : "An unexpected error occurred.",
    cause: error,
  };
}
