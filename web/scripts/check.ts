// Standalone sanity check for the live-feed RPC path (pure @stellar/stellar-sdk,
// the same calls `src/lib/events.ts` makes). The typed-bindings read path is
// covered by the production typecheck and by `stellar contract invoke`.
import { rpc, scValToNative } from "@stellar/stellar-sdk";

const RPC = "https://soroban-testnet.stellar.org";
const CONTRACT = "CAM3ICMZ5IIANPDDIM3BJMBSQAO2MYYXJOZCFVVKCBMSZNXVQRULBZJC";

async function main() {
  const server = new rpc.Server(RPC);
  const { sequence } = await server.getLatestLedger();
  console.log("latest ledger:", sequence);

  const res = await server.getEvents({
    startLedger: Math.max(1, sequence - 17280),
    filters: [{ type: "contract", contractIds: [CONTRACT] }],
    limit: 20,
  });
  console.log(`getEvents OK: ${res.events.length} event(s) from contract`);
  for (const e of res.events) {
    const topics = e.topic.map((t) => scValToNative(t));
    console.log("  -", topics[0], String(topics[1] ?? ""), "=>", scValToNative(e.value));
  }
  if (res.events.length === 0) {
    console.warn("WARNING: no events found in window (feed will backfill once contributions exist)");
  }
}

main().catch((e) => {
  console.error("CHECK FAILED:", e);
  process.exit(1);
});
