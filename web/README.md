# Lumina — frontend

Next.js 16 + TypeScript + Tailwind CSS frontend for the
[Lumina Soroban crowdfunding contract](../README.md).

## Quick start

```bash
cp .env.example .env.local   # pre-filled with the live testnet contract
npm install
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (+ TypeScript typecheck) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `node --experimental-strip-types scripts/check.ts` | RPC sanity check against testnet |

## Key directories

- `src/contracts/crowdfunding.ts` — generated typed bindings (`stellar contract bindings typescript`)
- `src/lib/` — `config`, `wallet` (StellarWalletsKit), `contract` (reads/writes + tx lifecycle), `events` (RPC `getEvents`), `errors`, `format`
- `src/hooks/` — `useWallet`, `useCampaign`, `useContractEvents`
- `src/components/` — `Dashboard`, `CampaignCard`, `ContributeForm`, `TxStatus`, `ActivityFeed`, `ManageActions`, `WalletButton`, `Toast`

See the [root README](../README.md) for full architecture, deployment facts, and contract details.
