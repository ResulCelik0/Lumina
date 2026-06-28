import { config } from "./config";

const DECIMALS = config.tokenDecimals;
const SCALE = 10n ** BigInt(DECIMALS);

/** Convert a human amount (e.g. "1.5") to stroops (bigint) without float drift. */
export function toStroops(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    throw new Error("Invalid amount");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > DECIMALS) {
    throw new Error(`Maximum ${DECIMALS} decimal places allowed`);
  }
  const paddedFraction = fraction.padEnd(DECIMALS, "0");
  return BigInt(whole || "0") * SCALE + BigInt(paddedFraction || "0");
}

/** Convert stroops (bigint) to a display string, trimming trailing zeros. */
export function fromStroops(stroops: bigint, maxFractionDigits = DECIMALS): string {
  const negative = stroops < 0n;
  const abs = negative ? -stroops : stroops;
  const whole = abs / SCALE;
  const fraction = abs % SCALE;
  let fractionStr = fraction.toString().padStart(DECIMALS, "0").slice(0, maxFractionDigits);
  fractionStr = fractionStr.replace(/0+$/, "");
  const wholeStr = whole.toLocaleString("en-US");
  const body = fractionStr ? `${wholeStr}.${fractionStr}` : wholeStr;
  return negative ? `-${body}` : body;
}

/** Format a token amount with its symbol, e.g. "12.5 XLM". */
export function formatToken(stroops: bigint, maxFractionDigits = 4): string {
  return `${fromStroops(stroops, maxFractionDigits)} ${config.tokenSymbol}`;
}

/** Shorten a Stellar address: GABC…WXYZ. */
export function shortenAddress(address: string, edge = 4): string {
  if (address.length <= edge * 2 + 1) return address;
  return `${address.slice(0, edge)}…${address.slice(-edge)}`;
}

/** Shorten a transaction hash for display. */
export function shortenHash(hash: string, edge = 6): string {
  if (hash.length <= edge * 2 + 1) return hash;
  return `${hash.slice(0, edge)}…${hash.slice(-edge)}`;
}

/** Percentage of goal reached, clamped to [0, 100]. */
export function progressPercent(raised: bigint, goal: bigint): number {
  if (goal <= 0n) return 0;
  const pct = Number((raised * 10000n) / goal) / 100;
  return Math.max(0, Math.min(100, pct));
}

/** Human-friendly countdown to a UNIX-second deadline. */
export function formatTimeLeft(deadlineUnix: number, nowMs = Date.now()): string {
  const deltaSec = deadlineUnix - Math.floor(nowMs / 1000);
  if (deltaSec <= 0) return "Ended";
  const days = Math.floor(deltaSec / 86400);
  const hours = Math.floor((deltaSec % 86400) / 3600);
  const minutes = Math.floor((deltaSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/** Relative "time ago" label for the activity feed. */
export function timeAgo(iso: string, nowMs = Date.now()): string {
  const deltaSec = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (deltaSec < 60) return `${deltaSec}s ago`;
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`;
  return `${Math.floor(deltaSec / 86400)}d ago`;
}
