# RemitChain Repository Audit Report

**Date:** 2026-11-23  
**Scope:** Full monorepo (`packages/contracts`, `packages/contracts-sdk`, `apps/web`, `apps/mobile`, `packages/ui`)  
**Assumed Load:** FYP demo / small beta (tens of users, <100 merchant booths, single Vercel deployment + Neon free tier on Polygon Amoy testnet).

---

## Executive Summary

RemitChain is a cross-border stablecoin remittance platform with gasless Account Abstraction transfers (`ZeroDev` + `Web3Auth`), an on-chain cash-out escrow (`RemittanceEscrow`), a yield vault (`YieldVault`), and a merchant booth registry (`BoothRegistry` + Pinata IPFS + Neon Postgres).

- **Overall Verdict:** **Fix Findings 1 and 2 before live demo.** Core smart contracts, Web API auth, and TypeScript builds are healthy (`17/17` Foundry tests, `11/11` Web/SDK tests), but two web-to-contract/DB wiring gaps prevent approved merchants from deactivating booths and seeing DB-persisted payout stats.
- **Lean Opportunity:** `-90 lines, -1 dependency (@repo/ui)` possible.

---

## Must Fix

### 1. Approved Booths Cannot Deactivate on the Web Portal
- **Files:** `apps/web/app/booth-application/page.tsx`, `packages/contracts/src/BoothRegistry.sol:L91-L110`
- **Root Cause:** `BoothRegistry.sol` enforces a 24-hour `COOLDOWN_PERIOD` for `Approved` booths via `requestExit()` before `cancelApplication()` can succeed (`require(requestedAt > 0 && block.timestamp >= requestedAt + COOLDOWN_PERIOD, "Cooldown active")`). However, `apps/web/app/booth-application/page.tsx` (`handleCancel`) calls `cancelApplication()` directly and has no UI or contract call for `requestExit()` or `exitRequestedAt()`.
- **User Impact:** Any approved merchant clicking **Deactivate Booth & Reclaim Stake** on the web portal receives a transaction revert (`Cooldown active`) and cannot withdraw their staked USDC.
- **Recommended Fix:**
  1. Add `requestExit`, `exitRequestedAt`, and `COOLDOWN_PERIOD` to `BOOTH_REGISTRY_ABI` in `packages/contracts-sdk/src/index.ts`.
  2. Read `exitRequestedAt(walletAddress)` inside `checkExistingBooth()` in `apps/web/app/booth-application/page.tsx`.
  3. When `exitRequestedAt === 0`, render **Request 24h Exit** (`requestExit()`). When `exitRequestedAt > 0` and `< exitRequestedAt + 86400`, display the unlock countdown. Enable **Reclaim Stake** (`cancelApplication()`) once the cooldown has elapsed.

### 2. Merchant Payout Stats Ignore Postgres on Page Load
- **Files:** `apps/web/app/booth-application/page.tsx`, `apps/web/app/api/payouts/route.ts:L8-L32`
- **Root Cause:** `confirmVerifyTransfer` writes claimed escrow payouts to `POST /api/payouts`, and `GET /api/payouts?booth=...` is implemented in `apps/web/app/api/payouts/route.ts`. However, `booth-application/page.tsx` only reads `remitchain_merchant_stats_<wallet>` from `localStorage` on load and never queries `GET /api/payouts`.
- **User Impact:** Opening the merchant portal on another browser/device or clearing browser cache shows `0` payouts, `$0.00` volume, and `$0.00` commissions even when Postgres has the merchant's records.
- **Recommended Fix:** Fetch `GET /api/payouts?booth=${walletAddress}` inside `checkExistingBooth()` and overwrite `stats` state whenever `data.configured === true` (keeping `localStorage` as fallback when DB is unconfigured).

---

## Should Fix

### 3. Missing Automated Tests for Mobile Crypto Backup & Wallet Services
- **Files:** `apps/mobile/src/services/backupService.ts`, `apps/mobile/src/services/walletService.ts`
- **Root Cause:** `backupService.encrypt()`/`decrypt()` (PBKDF2-SHA256 + AES-256-GCM) and `walletService.restoreWalletFromKey()`/`createCashOutOrder()` are verified only by `tsc --noEmit`, with zero runtime unit tests.
- **Impact:** A regression in cipher format or key derivation would only surface during manual device testing.
- **Recommended Fix:** Add a unit test verifying `backupService.encrypt()`/`decrypt()` roundtrip and wrong-passphrase rejection.

### 4. Duplicated Contract ABIs Across Web Pages
- **Files:** `apps/web/app/booth-application/page.tsx:L24-L65`, `apps/web/app/admin-dashboard/page.tsx:L25-L62`, `packages/contracts-sdk/src/index.ts`
- **Root Cause:** Both pages declare inline `BOOTH_REGISTRY_ABI` and `IERC20_ABI` constants instead of importing `BOOTH_REGISTRY_ABI` and `ERC20_ABI` from `@repo/contracts-sdk`.
- **Impact:** Contract updates (such as `requestExit` and `revokeBooth`) can drift out of sync between pages.
- **Recommended Fix:** Delete the inline ABI constants and import from `@repo/contracts-sdk`.

### 5. Unused `@repo/ui` Package & Dead `USE_SIMULATION` Config
- **Files:** `apps/web/package.json:L18`, `packages/ui/`, `apps/mobile/src/config/env.ts:L34`
- **Root Cause:** `@repo/ui` is a Turborepo starter stub never imported in `apps/web` or `apps/mobile`, and `USE_SIMULATION: true` in `env.ts` is never read (`walletService` checks `ZERODEV_PROJECT_ID.startsWith("00000000")`).
- **Recommended Fix:** Remove `@repo/ui` from `apps/web/package.json` (and remove `packages/ui` if unneeded) and delete `USE_SIMULATION` from `env.ts`.

---

## Nice to Have

### 6. Pre-Existing ESLint Warnings Block `pnpm lint`
- **Files:** `apps/web/app/whitepaper/page.tsx`, `apps/web/app/page.tsx`, `apps/web/app/booth-application/page.tsx`, `apps/web/app/admin-dashboard/page.tsx`
- **Root Cause:** `apps/web` enforces `eslint --max-warnings 0`, and 57 pre-existing warnings (`react/no-unescaped-entities`, `@next/next/no-img-element`, `any` on `window.ethereum`) cause `pnpm lint` to exit `1` despite `0` errors.
- **Recommended Fix:** Escape JSX quotes/apostrophes, add a typed `Window.ethereum` declaration, and resolve or suppress intentional `<img>` tags.

---

## Verification & Coverage Limits
- **Verified Passing:** `forge test -vvv` (`17/17`), `pnpm --filter web test` (`11/11`), `check-types` (`@repo/contracts-sdk`, `web`, `mobile`), `pnpm --filter web build` (`13/13` routes).
- **Not Checked:** Native Expo device build (`android`/`ios`) and live Polygon Amoy / ZeroDev / Web3Auth / Google Drive OAuth runtime flows.
