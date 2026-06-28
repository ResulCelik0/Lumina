/**
 * Multi-wallet integration via StellarWalletsKit (v2, static API).
 *
 * Registers several Stellar wallets so the user can pick whichever they have
 * installed: Freighter, xBull, Albedo, LOBSTR, Rabet and Hana. The kit renders
 * its own selection modal (`authModal`) listing every available option.
 *
 * Everything here is browser-only; `ensureKit()` guards against SSR by no-op'ing
 * on the server.
 */

import {
  StellarWalletsKit,
  Networks,
  KitEventType,
  type ISupportedWallet,
} from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { RabetModule } from "@creit.tech/stellar-wallets-kit/modules/rabet";
import { HanaModule } from "@creit.tech/stellar-wallets-kit/modules/hana";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";
import { config } from "./config";

/** Wallets offered in the connect modal (used for the static "supported" list). */
export const SUPPORTED_WALLETS = [
  "Freighter",
  "xBull",
  "Albedo",
  "LOBSTR",
  "Rabet",
  "Hana",
] as const;

let initialized = false;

/** Initialise the kit exactly once, on the client only. */
export function ensureKit(): boolean {
  if (typeof window === "undefined") return false;
  if (initialized) return true;
  StellarWalletsKit.init({
    network: Networks.TESTNET,
    modules: [
      new FreighterModule(),
      new xBullModule(),
      new AlbedoModule(),
      new LobstrModule(),
      new RabetModule(),
      new HanaModule(),
    ],
    authModal: { showInstallLabel: true },
  });
  initialized = true;
  return true;
}

/** Open the wallet-selection modal and return the chosen account address. */
export async function connectWallet(): Promise<string> {
  ensureKit();
  const { address } = await StellarWalletsKit.authModal();
  return address;
}

/** Disconnect the active wallet and clear persisted selection. */
export async function disconnectWallet(): Promise<void> {
  if (!ensureKit()) return;
  await StellarWalletsKit.disconnect();
}

/** Best-effort read of an already-connected address (null if none). */
export async function getConnectedAddress(): Promise<string | null> {
  if (!ensureKit()) return null;
  try {
    const { address } = await StellarWalletsKit.getAddress();
    return address && address.length > 0 ? address : null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to wallet state changes (connect / disconnect / account switch).
 * Returns an unsubscribe function. Fires immediately with current state.
 */
export function onWalletStateChange(cb: (address: string | null) => void): () => void {
  if (!ensureKit()) return () => {};
  return StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
    cb(event.payload.address ?? null);
  });
}

/** Build a `SignTransaction` callback bound to the connected account. */
export function walletSigner(address: string): SignTransaction {
  return async (xdr, opts) => {
    ensureKit();
    const { signedTxXdr, signerAddress } = await StellarWalletsKit.signTransaction(xdr, {
      address: opts?.address ?? address,
      networkPassphrase: opts?.networkPassphrase ?? config.networkPassphrase,
    });
    return { signedTxXdr, signerAddress };
  };
}

/** Live list of wallets the kit detected (installed/available flags included). */
export async function listSupportedWallets(): Promise<ISupportedWallet[]> {
  if (!ensureKit()) return [];
  return StellarWalletsKit.refreshSupportedWallets();
}
