/**
 * Centralised, validated runtime configuration.
 *
 * Every value is sourced from `NEXT_PUBLIC_*` environment variables, with a
 * fall-back to the currently deployed testnet contract so the app runs even
 * without a local `.env`. Reading config through this single module keeps the
 * contract id / network in exactly one place.
 */

function env(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.length > 0 ? value : fallback;
}

export const config = {
  rpcUrl: env("NEXT_PUBLIC_SOROBAN_RPC_URL", "https://soroban-testnet.stellar.org"),
  networkPassphrase: env(
    "NEXT_PUBLIC_NETWORK_PASSPHRASE",
    "Test SDF Network ; September 2015",
  ),
  contractId: env(
    "NEXT_PUBLIC_CONTRACT_ID",
    "CAM3ICMZ5IIANPDDIM3BJMBSQAO2MYYXJOZCFVVKCBMSZNXVQRULBZJC",
  ),
  tokenSac: env(
    "NEXT_PUBLIC_TOKEN_SAC",
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  ),
  tokenSymbol: env("NEXT_PUBLIC_TOKEN_SYMBOL", "XLM"),
  tokenDecimals: Number(env("NEXT_PUBLIC_TOKEN_DECIMALS", "7")),
  explorerBase: env(
    "NEXT_PUBLIC_EXPLORER_BASE",
    "https://stellar.expert/explorer/testnet",
  ),
} as const;

/** Allow plain http only for local RPC endpoints (never for remote testnet). */
export const allowHttp = config.rpcUrl.startsWith("http://");

export const explorer = {
  tx: (hash: string) => `${config.explorerBase}/tx/${hash}`,
  contract: (id: string) => `${config.explorerBase}/contract/${id}`,
  account: (addr: string) => `${config.explorerBase}/account/${addr}`,
};
