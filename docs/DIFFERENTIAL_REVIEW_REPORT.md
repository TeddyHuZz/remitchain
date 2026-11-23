# Differential Security Review Report (Re-Scan: `fd0489e..working-tree`)

## 1. Executive Summary

| Severity | Previous | Current (Re-Scan) |
| :--- | :---: | :---: |
| 🔴 CRITICAL | 0 | **0** |
| 🟠 HIGH | 3 | **0** |
| 🟡 MEDIUM | 4 | **3** |
| 🟢 LOW | 2 | **2** |

- **Overall Risk:** **LOW / MEDIUM** (all 3 HIGH findings and 2 MEDIUM findings from the initial scan are resolved)
- **Recommendation:** **APPROVE** for Polygon Amoy FYP / Staging deployment.
- **Key Metrics:**
  - **Codebase Size:** 91 source files (`MEDIUM` — Focused analysis)
  - **Latest Fix Pass:** 12 modified files + `security.test.ts` (`+195 / -21` lines)
  - **Tests Passing:** Foundry `16/16` (`BoothRegistryTest`, `YieldVaultTest`, `RemittanceEscrowTest`), Web/SDK `9/9` (`ipfs/route.test.ts`, `webhooks/alchemy/route.test.ts`, `security.test.ts`, `contracts-sdk.test.ts`), `check-types` (`0` errors), `next build` (`13/13` routes).
  - **Security Regressions Detected:** 0

---

## 2. Resolved Findings (Verified in Current Working Tree)

| ID | File | Fix Verified | Test |
| :--- | :--- | :--- | :--- |
| **HIGH-1** | `apps/web/app/api/merchants/route.ts:11-62` | `GET /api/merchants` requires EIP-191 signature + 5-min timestamp; full list requires `BoothRegistry.owner()`. | Typechecked & built |
| **HIGH-2a** | `apps/web/app/api/payouts/route.ts:44-76` | `POST /api/payouts` validates `txHash` format and verifies on-chain `OrderClaimed` receipt from `NEXT_PUBLIC_REMITTANCE_ESCROW_ADDRESS`. | `security.test.ts` (400 check) |
| **HIGH-2b** | `apps/web/app/api/push-tokens/route.ts:19-34` | `POST /api/push-tokens` requires EIP-191 signature + 5-min timestamp. | Typechecked & built |
| **HIGH-3** | `apps/web/app/api/webhooks/alchemy/route.ts:34-41` | Filters `event.activity` to only index `act.rawContract.address === NEXT_PUBLIC_USDC_ADDRESS`. | `security.test.ts` (spam token ignored) |
| **MEDIUM-1** | `packages/contracts/src/YieldVault.sol:98-126` | Uses global cumulative `accruedIndex` updated in `deposit`, `withdraw`, and `setAPY` (prevents retroactive APY changes). | `YieldVault.t.sol` (`test_SetAPYDoesNotApplyRetroactively`) |
| **MEDIUM-2** | `packages/contracts/src/BoothRegistry.sol:81-89`, `DashboardScreen.tsx:134-141` | Added `onlyOwner` `revokeBooth(address)` and 8-char alphanumeric pickup codes (`REMIT-XXXXXXXX`). | `BoothRegistry.t.sol` (`test_RevokeApprovedBooth`) |

---

## 3. Remaining Findings (Acceptable for FYP / Non-Blocking)

### 🟡 MEDIUM-1: Push Token Address Mismatch for AA Transfers
- **Files:** `apps/mobile/src/services/pushService.ts`, `apps/web/app/api/webhooks/alchemy/route.ts:55`
- **Description:** `DashboardScreen.tsx` registers `wallet.eoaAddress` with `/api/push-tokens` (because EOA signs EIP-191 messages), whereas `webhooks/alchemy` looks up `toAddress` (which is `smartAccountAddress` on AA transfers). No security vulnerability, but push notifications won't fire for AA `smartAccountAddress` transfers unless `smartAccountAddress` is also mapped/verified via ERC-1271.

### 🟡 MEDIUM-2: Public `GET /api/history` & `MockUSDC.faucet()`
- **Files:** `apps/web/app/api/history/route.ts:16-24`, `packages/contracts/src/MockUSDC.sol:17-19`
- **Description:** `GET /api/history` is public (matches public chain data, lacks rate limiting). `MockUSDC.faucet()` is intentionally public for testnet demos—use Circle's official USDC on mainnet.

### 🟡 MEDIUM-3: `BoothRegistry.cancelApplication()` O(n) Loop & Instant Exit
- **File:** `packages/contracts/src/BoothRegistry.sol:91-110`
- **Description:** Linear scan over `boothAddresses` (fine for FYP scale) and no dispute cooldown on `Approved` booth exit.

### 🟢 LOW-1 & LOW-2: Dev Fallbacks & Remaining Test Gaps
- `backupService.ts` falls back to `SecureStore` simulation when `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is unset.
- `merchants/route.ts` `GET`, `push-tokens/route.ts`, `walletService.ts`, and `backupService.ts` rely on TypeScript + manual testing rather than automated unit tests.

---

## 4. Coverage Limitations & Confidence
- **Verified:** `forge test -vvv` (`16/16`), `pnpm --filter web test` (`9/9`), `check-types` (`@repo/contracts-sdk`, `web`, `mobile`), and `next build` (`13/13` routes).
- **Not Executed:** Live Polygon Amoy RPC/ZeroDev/Web3Auth/Neon E2E and physical Expo device builds.
- **Confidence:** **High** on contracts and Web API security.
