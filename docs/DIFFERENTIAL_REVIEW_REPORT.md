# Differential Security Review Report (Final Scan: `fd0489e..3f169cf`)

## 1. Executive Summary

| Severity | Initial Scan | 2nd Scan | Final (`3f169cf`) |
| :--- | :---: | :---: | :---: |
| 🔴 CRITICAL | 0 | 0 | **0** |
| 🟠 HIGH | 3 | 0 | **0** |
| 🟡 MEDIUM | 4 | 3 | **0** |
| 🟢 LOW | 2 | 2 | **2** |

- **Overall Risk:** **LOW**
- **Recommendation:** **APPROVE** — Ready for Polygon Amoy deployment and FYP evaluation.
- **Key Metrics:**
  - **Codebase Size:** 91 source files (`MEDIUM` — Focused analysis)
  - **Latest Fix Pass (`c185de6..3f169cf`):** 14 files changed (`+349 / -30` lines)
  - **Tests Passing:** Foundry `17/17`, Web/SDK `11/11`, `check-types` (`0` errors), `next build` (`13/13` routes)
  - **Security Regressions Detected:** 0

---

## 2. All Security Fixes Verified at `3f169cf`

| ID | File | Resolution | Commit |
| :--- | :--- | :--- | :--- |
| **HIGH-1** | `apps/web/app/api/merchants/route.ts` | `GET` requires EIP-191 signature + 5-min timestamp; full list requires `BoothRegistry.owner()`. | `ae26c23` |
| **HIGH-2a** | `apps/web/app/api/payouts/route.ts` | `POST` validates `txHash` and verifies on-chain `OrderClaimed` receipt from `REMITTANCE_ESCROW_ADDRESS`. | `ae26c23` |
| **HIGH-2b** | `apps/web/app/api/push-tokens/route.ts` | `POST` requires EIP-191 / ERC-1271 signature (`publicClient.verifyMessage`). | `ae26c23` |
| **HIGH-3** | `apps/web/app/api/webhooks/alchemy/route.ts` | Filters `event.activity` to `NEXT_PUBLIC_USDC_ADDRESS` only. | `ae26c23` |
| **MEDIUM-1** | `packages/contracts/src/YieldVault.sol` | Global cumulative `accruedIndex` prevents retroactive `setAPY` changes. | `7d49627` |
| **MEDIUM-2** | `packages/contracts/src/BoothRegistry.sol`, `DashboardScreen.tsx` | Added `onlyOwner` `revokeBooth(address)` + 8-char alphanumeric pickup codes (`REMIT-XXXXXXXX`). | `7d49627`, `3f169cf` |
| **MEDIUM-3** | `packages/contracts/src/BoothRegistry.sol` | Added O(1) `boothIndex` swap-and-pop + `requestExit()` 1-day `COOLDOWN_PERIOD` for `Approved` booths. | `7d49627` |
| **MEDIUM-4** | `apps/web/app/api/history/route.ts` | Added sliding-window rate limiting (`30 req/min/IP`, `429`). | `ae26c23` |
| **MEDIUM-5** | `apps/mobile/src/screens/DashboardScreen.tsx`, `pushService.ts` | Aligned push registration to `smartAccountAddress` in live mode. | `3f169cf` |

---

## 3. Remaining Low-Severity Notes (Intentional / Non-Blocking)
- **LOW-1 (`backupService.ts`):** Falls back to `SecureStore` simulation when `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is unset (intentional for emulator testing).
- **LOW-2 (Test Coverage):** Mobile services (`walletService`, `backupService`) rely on TypeScript + manual testing; `history/route.ts` uses an in-memory rate-limit `Map` (resets on serverless cold starts).

---

## 4. Coverage & Confidence
- **Verified:** `forge test -vvv` (`17/17`), `pnpm --filter web test` (`11/11`), `check-types` (`@repo/contracts-sdk`, `web`, `mobile`), and `next build` (`13/13` routes).
- **Confidence:** **High** on contracts and Web API security.
