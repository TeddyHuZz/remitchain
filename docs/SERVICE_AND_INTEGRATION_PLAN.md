# RemitChain Service, Wiring & FYP Integration Plan

> **Budget Target:** $0/month (100% Free Tier on Polygon Amoy Testnet).

---

## Part A: Already in the Codebase, Not Yet Wired

### 1. Google Drive Cloud Wallet Backup (`apps/mobile/src/services/backupService.ts`)
- **Usage:** Encrypts and stores the user's EOA private key in their private Google Drive `appDataFolder` so biometric/local-key users can recover funds on a new device.
- **Current Gap:** `BackupService` is never imported; it reads `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS` (missing from `env.ts` / `.env.example`), and `encrypt()`/`decrypt()` uses a weak XOR hex cipher.
- **How to Wire (Optional Phase 3):**
  1. Replace `encrypt()`/`decrypt()` with AES-256-GCM (via `react-native-quick-crypto` or `@noble/ciphers`) keyed by a user recovery passphrase.
  2. Add `EXPO_PUBLIC_GOOGLE_CLIENT_ID` to `apps/mobile/src/config/env.ts` and `.env.example`.
  3. Add **Back Up Wallet** and **Restore from Drive** buttons in `ProfileTab.tsx` and `AuthScreen.tsx`.

### 2. Deployed Escrow, Yield & MockUSDC Contracts (`packages/contracts`)
- **Usage:** `RemittanceEscrow` holds USDC until a merchant claims it with the pickup code; `MockUSDC.faucet()` mints test USDC; `YieldVault` accrues savings yield.
- **Current Gap:** `REMITTANCE_ESCROW_ADDRESS` and `YIELD_VAULT_ADDRESS` default to `0x0000...0000` until deployed and added to `.env`.
- **How to Wire (Phase 1):**
  1. Run `forge script script/DeployAll.s.sol --rpc-url $POLYGON_AMOY_RPC_URL --broadcast` in `packages/contracts`.
  2. Populate `NEXT_PUBLIC_*` in `apps/web/.env.local` and `EXPO_PUBLIC_*` in `apps/mobile/.env`.

### 3. ZeroDev Account Abstraction & Web3Auth (`apps/mobile/src/services/walletService.ts`)
- **Usage:** Sponsors gas (`UserOperation`s via Kernel v3.1) and provides Google MPC login.
- **Current Gap:** `ZERODEV_PROJECT_ID` defaults to `00000000-...`, keeping mobile in simulation mode.
- **How to Wire (Phase 1):**
  1. Create a ZeroDev v3 Sandbox (Polygon Amoy) project with a gas sponsorship policy.
  2. Create a Web3Auth Sapphire Devnet project with `remitchain://auth` as an allowed redirect URI.
  3. Set `EXPO_PUBLIC_ZERODEV_PROJECT_ID`, `EXPO_PUBLIC_WEB3AUTH_CLIENT_ID`, and `EXPO_PUBLIC_WEB3AUTH_CONNECTION_ID` in `apps/mobile/.env`.

### 4. Starter Docs App (`apps/docs`)
- **Usage:** Intended for merchant onboarding/API docs, currently an untouched Turborepo starter.
- **How to Handle:** Either replace `apps/docs/app/page.tsx` with merchant integration docs or remove `apps/docs` to keep the monorepo lean.

---

## Part B: FYP Necessity & Free-Tier Matrix

### Needed for FYP ($0/mo Free Tiers)
| Service | Free Tier Limits | Why We Need It |
| :--- | :--- | :--- |
| **ZeroDev (Sandbox)** | $0/mo (testnet-only, 10k credits/mo) | Real gasless `UserOperation`s on Polygon Amoy. |
| **Web3Auth** | $0/mo (up to 1,000 MAWs) | Real Google MPC login on mobile. |
| **Alchemy (RPC + Webhooks)** | $0/mo (30M CUs/mo, 5 webhooks) | Reliable RPC (no public node throttling) + free event webhooks. |
| **Pinata (IPFS)** | $0/mo (1 GB, 500 files, 1 dedicated gateway) | Fast booth metadata loading without `ipfs.io` timeouts. |
| **Neon (Serverless Postgres)** | $0/mo (1 GB storage, 100 CU-hrs/mo) | Off-chain merchant PII, persistent payout stats, and indexed txs. |
| **Vercel (Hobby)** | $0/mo | Public HTTPS hosting for `apps/web` during demos. |
| **Self-Hosted Globe Textures** | $0 (files in `apps/web/public/textures/`) | Eliminates `unpkg.com` runtime dependency on the 3D globe. |

### Optional Polish ($0/mo, Implement If Time Permits)
- **Expo Push Notifications ($0):** Notify recipient when USDC arrives or merchant when an escrow order is created.
- **Sentry Developer ($0):** Error/crash tracking for FYP observability documentation.
- **Google Drive Backup (`backupService.ts`, $0):** Only after upgrading XOR cipher to AES-256-GCM.

### Not Needed for FYP (Skip for Now)
- **Paid KYC/AML Providers (Sumsub, Persona, Onfido):** Require registered business entities and paid contracts. Our Admin Dashboard + Neon DB review workflow serves as the compliance gate.
- **Paid Subgraph / Indexer Hosting (Goldsky, etc.):** Replaced at $0 by **Alchemy Webhooks → Next.js API → Neon Postgres**.
- **Mainnet Paid Plans (ZeroDev Launch, Alchemy Growth, Pinata Picnic):** Only required for real-money mainnet launch.

---

## Part C: Phased Implementation Roadmap

### Phase 1: Core Wiring & Reliable Demo Infra (Do First)
- [ ] Deploy `DeployAll.s.sol` to Polygon Amoy (`MockUSDC`, `BoothRegistry`, `YieldVault`, `RemittanceEscrow`).
- [ ] Configure Alchemy Amoy RPC, Pinata dedicated gateway, ZeroDev Sandbox ID, and Web3Auth Client ID in `.env` / `.env.local`.
- [ ] Download `earth-night.jpg` and `earth-topology.png` into `apps/web/public/textures/` and update `Globe.tsx`.
- [ ] Deploy `apps/web` to Vercel Hobby.

### Phase 2: Neon Postgres & Zero-Cost Indexer (Production-Grade FYP Upgrade)
- [ ] Provision a **Neon** free-tier Postgres database.
- [ ] Add schema for `merchants` (private `ownerName`, `email`, verification status), `payouts` (replacing `localStorage`), and `transactions` (`OrderCreated`, `OrderClaimed`, `Transfer`).
- [ ] Add Next.js API routes:
  - `POST /api/merchants` (wallet-signature authenticated PII storage).
  - `POST /api/webhooks/alchemy` (verifies Alchemy signing key and inserts indexed events into Neon).
  - `GET /api/history` & `GET /api/booths` (fast DB-backed reads for Mobile `HistoryTab.tsx` and Web `Globe.tsx` / `admin-dashboard`).

### Phase 3: Optional Polish (Only After Phase 1 & 2 Pass)
- [ ] Wire **Expo Push Notifications** triggered from `/api/webhooks/alchemy`.
- [ ] Upgrade `backupService.ts` to AES-256-GCM and wire into `ProfileTab.tsx` / `AuthScreen.tsx`.
- [ ] Add **Sentry** (`@sentry/nextjs`, `@sentry/react-native`).
