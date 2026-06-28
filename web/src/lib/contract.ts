/**
 * Contract interaction layer.
 *
 * Wraps the generated, type-safe `Client` (from `stellar contract bindings
 * typescript`) with:
 *  - read helpers (`fetchCampaign`, `fetchContribution`) that simulate only;
 *  - write helpers (`contribute`, `withdraw`, `refund`) that drive an explicit
 *    build → sign → submit → confirm lifecycle and report each phase back to the
 *    UI via an `onProgress` callback, so transaction status is always visible.
 */

import { Buffer } from "buffer";
import { Client } from "@/contracts/crowdfunding";
import type { AssembledTransaction, Result, i128 } from "@stellar/stellar-sdk/contract";
import { allowHttp, config } from "./config";
import { mapError, type AppError } from "./errors";
import { walletSigner } from "./wallet";

export interface CampaignView {
  admin: string;
  token: string;
  goal: bigint;
  deadline: number; // UNIX seconds
  totalRaised: bigint;
  withdrawn: boolean;
}

export type TxPhase = "idle" | "building" | "signing" | "pending" | "success" | "error";

export interface TxProgress {
  phase: TxPhase;
  /** Available from the "pending" phase onward. */
  hash?: string;
  error?: AppError;
}

/** Read-only client (no signer); fine for simulation-only calls. */
function readClient(): Client {
  return new Client({
    contractId: config.contractId,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
    allowHttp,
  });
}

/** Write client bound to a connected wallet address. */
function writeClient(address: string): Client {
  return new Client({
    contractId: config.contractId,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
    allowHttp,
    publicKey: address,
    signTransaction: walletSigner(address),
  });
}

// ----------------------------------- Reads -----------------------------------

export async function fetchCampaign(): Promise<CampaignView> {
  const tx = await readClient().get_campaign();
  const result = tx.result;
  if (result.isErr()) {
    throw new Error(result.unwrapErr().message);
  }
  const c = result.unwrap();
  return {
    admin: c.admin,
    token: c.token,
    goal: BigInt(c.goal),
    deadline: Number(c.deadline),
    totalRaised: BigInt(c.total_raised),
    withdrawn: c.withdrawn,
  };
}

export async function fetchContribution(address: string): Promise<bigint> {
  const tx = await readClient().get_contribution({ who: address });
  return BigInt(tx.result);
}

// ---------------------------------- Writes -----------------------------------

/**
 * Generic write driver: builds + simulates the transaction, signs it with the
 * wallet, submits it, and waits for confirmation — emitting a `TxProgress`
 * update at every phase. Returns the final on-chain return value.
 */
/** All three write methods return `Result<i128>` on-chain. */
type WriteTx = AssembledTransaction<Result<i128>>;

async function runWrite(
  address: string,
  build: (client: Client) => Promise<WriteTx>,
  onProgress: (p: TxProgress) => void,
): Promise<{ hash: string; value: bigint }> {
  try {
    onProgress({ phase: "building" });
    const tx = await build(writeClient(address));

    // Simulation may already reveal a contract-level error (e.g. DeadlinePassed).
    if (tx.result.isErr()) {
      throw new Error(tx.result.unwrapErr().message);
    }

    onProgress({ phase: "signing" });
    await tx.sign({ signTransaction: walletSigner(address) });

    // The hash is known the moment the envelope is signed — surface it before
    // confirmation so the user can track the pending transaction immediately.
    const hash = tx.signed ? Buffer.from(tx.signed.hash()).toString("hex") : "";
    onProgress({ phase: "pending", hash });

    const sent = await tx.send();
    if (sent.result.isErr()) {
      throw new Error(sent.result.unwrapErr().message);
    }

    onProgress({ phase: "success", hash });
    return { hash, value: BigInt(sent.result.unwrap()) };
  } catch (err) {
    const appError = mapError(err);
    onProgress({ phase: "error", error: appError });
    throw appError;
  }
}

/** Contribute `amount` stroops to the campaign. */
export function contribute(
  address: string,
  amount: bigint,
  onProgress: (p: TxProgress) => void,
): Promise<{ hash: string; value: bigint }> {
  return runWrite(address, (client) => client.contribute({ from: address, amount }), onProgress);
}

/** Admin withdraws raised funds (after deadline, goal met). */
export function withdraw(
  address: string,
  onProgress: (p: TxProgress) => void,
): Promise<{ hash: string; value: bigint }> {
  return runWrite(address, (client) => client.withdraw(), onProgress);
}

/** Reclaim a contribution (after deadline, goal not met). */
export function refund(
  address: string,
  onProgress: (p: TxProgress) => void,
): Promise<{ hash: string; value: bigint }> {
  return runWrite(address, (client) => client.refund({ to: address }), onProgress);
}
