import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAM3ICMZ5IIANPDDIM3BJMBSQAO2MYYXJOZCFVVKCBMSZNXVQRULBZJC",
  }
} as const

export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"InvalidAmount"},
  4: {message:"InvalidDeadline"},
  5: {message:"DeadlinePassed"},
  6: {message:"DeadlineNotReached"},
  7: {message:"GoalNotReached"},
  8: {message:"GoalAlreadyReached"},
  9: {message:"NothingToRefund"},
  10: {message:"AlreadyWithdrawn"},
  11: {message:"MathOverflow"}
}

export type DataKey = {tag: "Admin", values: void} | {tag: "Token", values: void} | {tag: "Goal", values: void} | {tag: "Deadline", values: void} | {tag: "TotalRaised", values: void} | {tag: "Withdrawn", values: void} | {tag: "Contribution", values: readonly [string]};


/**
 * Aggregated, read-only campaign view returned to the frontend in a single
 * RPC simulation (cheaper than 6 separate getters).
 */
export interface Campaign {
  admin: string;
  deadline: u64;
  goal: i128;
  token: string;
  total_raised: i128;
  withdrawn: boolean;
}

export interface Client {
  /**
   * Construct and simulate a refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Refund a contributor. Allowed only after the deadline and only if the
   * goal was *not* reached. The caller can only refund their own balance.
   */
  refund: ({to}: {to: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_goal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_goal: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin withdraws the raised funds. Allowed only once, only after the
   * deadline, and only if the goal was reached.
   */
  withdraw: (options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a contribute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Contribute `amount` of the campaign token. Requires the contributor's
   * authorization (the token transfer is pulled from `from`).
   */
  contribute: ({from, amount}: {from: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the campaign. Callable exactly once.
   * 
   * * `admin` — receives the funds on a successful campaign.
   * * `token` — SEP-41 token accepted for contributions (e.g. native SAC).
   * * `goal` — funding target, in the token's smallest unit (stroops for XLM).
   * * `deadline` — UNIX timestamp (seconds) after which contributions close.
   */
  initialize: ({admin, token, goal, deadline}: {admin: string, token: string, goal: i128, deadline: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_campaign transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Single-call snapshot of the whole campaign (used by the frontend).
   */
  get_campaign: (options?: MethodOptions) => Promise<AssembledTransaction<Result<Campaign>>>

  /**
   * Construct and simulate a get_deadline transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_deadline: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a get_contribution transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * How much `who` has contributed (and could reclaim on a failed campaign).
   */
  get_contribution: ({who}: {who: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_total_raised transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_total_raised: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACwAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAMAAAAAAAAAD0ludmFsaWREZWFkbGluZQAAAAAEAAAAAAAAAA5EZWFkbGluZVBhc3NlZAAAAAAABQAAAAAAAAASRGVhZGxpbmVOb3RSZWFjaGVkAAAAAAAGAAAAAAAAAA5Hb2FsTm90UmVhY2hlZAAAAAAABwAAAAAAAAASR29hbEFscmVhZHlSZWFjaGVkAAAAAAAIAAAAAAAAAA9Ob3RoaW5nVG9SZWZ1bmQAAAAACQAAAAAAAAAQQWxyZWFkeVdpdGhkcmF3bgAAAAoAAAAAAAAADE1hdGhPdmVyZmxvdwAAAAs=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABwAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAFVG9rZW4AAAAAAAAAAAAAAAAAAARHb2FsAAAAAAAAAAAAAAAIRGVhZGxpbmUAAAAAAAAAAAAAAAtUb3RhbFJhaXNlZAAAAAAAAAAAAAAAAAlXaXRoZHJhd24AAAAAAAABAAAAAAAAAAxDb250cmlidXRpb24AAAABAAAAEw==",
        "AAAAAQAAAHpBZ2dyZWdhdGVkLCByZWFkLW9ubHkgY2FtcGFpZ24gdmlldyByZXR1cm5lZCB0byB0aGUgZnJvbnRlbmQgaW4gYSBzaW5nbGUKUlBDIHNpbXVsYXRpb24gKGNoZWFwZXIgdGhhbiA2IHNlcGFyYXRlIGdldHRlcnMpLgAAAAAAAAAAAAhDYW1wYWlnbgAAAAYAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAARnb2FsAAAACwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAx0b3RhbF9yYWlzZWQAAAALAAAAAAAAAAl3aXRoZHJhd24AAAAAAAAB",
        "AAAAAAAAAItSZWZ1bmQgYSBjb250cmlidXRvci4gQWxsb3dlZCBvbmx5IGFmdGVyIHRoZSBkZWFkbGluZSBhbmQgb25seSBpZiB0aGUKZ29hbCB3YXMgKm5vdCogcmVhY2hlZC4gVGhlIGNhbGxlciBjYW4gb25seSByZWZ1bmQgdGhlaXIgb3duIGJhbGFuY2UuAAAAAAZyZWZ1bmQAAAAAAAEAAAAAAAAAAnRvAAAAAAATAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAAAAAAAAIZ2V0X2dvYWwAAAAAAAAAAQAAAAs=",
        "AAAAAAAAAG9BZG1pbiB3aXRoZHJhd3MgdGhlIHJhaXNlZCBmdW5kcy4gQWxsb3dlZCBvbmx5IG9uY2UsIG9ubHkgYWZ0ZXIgdGhlCmRlYWRsaW5lLCBhbmQgb25seSBpZiB0aGUgZ29hbCB3YXMgcmVhY2hlZC4AAAAACHdpdGhkcmF3AAAAAAAAAAEAAAPpAAAACwAAAAM=",
        "AAAAAAAAAH9Db250cmlidXRlIGBhbW91bnRgIG9mIHRoZSBjYW1wYWlnbiB0b2tlbi4gUmVxdWlyZXMgdGhlIGNvbnRyaWJ1dG9yJ3MKYXV0aG9yaXphdGlvbiAodGhlIHRva2VuIHRyYW5zZmVyIGlzIHB1bGxlZCBmcm9tIGBmcm9tYCkuAAAAAApjb250cmlidXRlAAAAAAACAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAAUxJbml0aWFsaXplIHRoZSBjYW1wYWlnbi4gQ2FsbGFibGUgZXhhY3RseSBvbmNlLgoKKiBgYWRtaW5gIOKAlCByZWNlaXZlcyB0aGUgZnVuZHMgb24gYSBzdWNjZXNzZnVsIGNhbXBhaWduLgoqIGB0b2tlbmAg4oCUIFNFUC00MSB0b2tlbiBhY2NlcHRlZCBmb3IgY29udHJpYnV0aW9ucyAoZS5nLiBuYXRpdmUgU0FDKS4KKiBgZ29hbGAg4oCUIGZ1bmRpbmcgdGFyZ2V0LCBpbiB0aGUgdG9rZW4ncyBzbWFsbGVzdCB1bml0IChzdHJvb3BzIGZvciBYTE0pLgoqIGBkZWFkbGluZWAg4oCUIFVOSVggdGltZXN0YW1wIChzZWNvbmRzKSBhZnRlciB3aGljaCBjb250cmlidXRpb25zIGNsb3NlLgAAAAppbml0aWFsaXplAAAAAAAEAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAEZ29hbAAAAAsAAAAAAAAACGRlYWRsaW5lAAAABgAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAEJTaW5nbGUtY2FsbCBzbmFwc2hvdCBvZiB0aGUgd2hvbGUgY2FtcGFpZ24gKHVzZWQgYnkgdGhlIGZyb250ZW5kKS4AAAAAAAxnZXRfY2FtcGFpZ24AAAAAAAAAAQAAA+kAAAfQAAAACENhbXBhaWduAAAAAw==",
        "AAAAAAAAAAAAAAAMZ2V0X2RlYWRsaW5lAAAAAAAAAAEAAAAG",
        "AAAAAAAAAEhIb3cgbXVjaCBgd2hvYCBoYXMgY29udHJpYnV0ZWQgKGFuZCBjb3VsZCByZWNsYWltIG9uIGEgZmFpbGVkIGNhbXBhaWduKS4AAAAQZ2V0X2NvbnRyaWJ1dGlvbgAAAAEAAAAAAAAAA3dobwAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAQZ2V0X3RvdGFsX3JhaXNlZAAAAAAAAAABAAAACw==" ]),
      options
    )
  }
  public readonly fromJSON = {
    refund: this.txFromJSON<Result<i128>>,
        get_goal: this.txFromJSON<i128>,
        withdraw: this.txFromJSON<Result<i128>>,
        contribute: this.txFromJSON<Result<i128>>,
        initialize: this.txFromJSON<Result<void>>,
        get_campaign: this.txFromJSON<Result<Campaign>>,
        get_deadline: this.txFromJSON<u64>,
        get_contribution: this.txFromJSON<i128>,
        get_total_raised: this.txFromJSON<i128>
  }
}