/**
 * Real-time contract event streaming.
 *
 * Polls the Soroban RPC `getEvents` endpoint for events emitted by the
 * crowdfunding contract and decodes them into typed {@link CampaignEvent}s.
 *
 * The first fetch backfills a recent ledger window (so the activity feed isn't
 * empty on load); subsequent fetches page forward from the returned cursor, so
 * only brand-new events are pulled on each tick.
 */

import { rpc, scValToNative } from "@stellar/stellar-sdk";
import { allowHttp, config } from "./config";

export type CampaignEventType =
  | "initialized"
  | "contribute"
  | "withdraw"
  | "refund"
  | "unknown";

export interface CampaignEvent {
  id: string;
  type: CampaignEventType;
  who: string;
  /** contribute/withdraw/refund amount, in stroops */
  amount?: bigint;
  /** running total after a contribution, in stroops */
  total?: bigint;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
}

export interface EventPage {
  events: CampaignEvent[];
  cursor: string;
  latestLedger: number;
}

/** ~1h of ledgers (≈5s each) — a safe backfill window within RPC retention. */
const BACKFILL_LEDGERS = 720;

const server = new rpc.Server(config.rpcUrl, { allowHttp });

const FILTERS = [{ type: "contract" as const, contractIds: [config.contractId] }];

function decode(e: rpc.Api.EventResponse): CampaignEvent | null {
  try {
    const topics = e.topic.map((t) => scValToNative(t));
    const type = String(topics[0] ?? "unknown") as CampaignEventType;
    const who = topics[1] != null ? String(topics[1]) : "";
    const value = scValToNative(e.value);

    let amount: bigint | undefined;
    let total: bigint | undefined;
    if (type === "contribute" && Array.isArray(value)) {
      amount = BigInt(value[0]);
      total = BigInt(value[1]);
    } else if (type === "withdraw" || type === "refund") {
      amount = BigInt(value);
    }

    return {
      id: e.id,
      type,
      who,
      amount,
      total,
      ledger: e.ledger,
      ledgerClosedAt: e.ledgerClosedAt,
      txHash: e.txHash,
    };
  } catch {
    return null;
  }
}

function toPage(res: rpc.Api.GetEventsResponse): EventPage {
  const events = res.events
    .map(decode)
    .filter((e): e is CampaignEvent => e !== null);
  return { events, cursor: res.cursor, latestLedger: res.latestLedger };
}

/** Initial fetch: backfill a recent window of events. */
export async function fetchRecentEvents(limit = 100): Promise<EventPage> {
  const { sequence } = await server.getLatestLedger();
  const startLedger = Math.max(1, sequence - BACKFILL_LEDGERS);
  const res = await server.getEvents({ startLedger, filters: FILTERS, limit });
  return toPage(res);
}

/** Incremental fetch: only events newer than the given cursor. */
export async function fetchEventsSince(cursor: string, limit = 100): Promise<EventPage> {
  const res = await server.getEvents({ cursor, filters: FILTERS, limit });
  return toPage(res);
}
