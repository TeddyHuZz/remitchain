import test from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData, keccak256, parseUnits, toBytes } from "viem";
import {
  AMOY_CHAIN_ID,
  BOOTH_REGISTRY_ABI,
  ERC20_ABI,
  REMITTANCE_ESCROW_ABI,
  YIELD_VAULT_ABI,
} from "@repo/contracts-sdk";

test("exports Polygon Amoy chain config and contract ABIs", () => {
  assert.equal(AMOY_CHAIN_ID, 80002);
  assert.ok(ERC20_ABI.some((item) => item.name === "transfer"));
  assert.ok(BOOTH_REGISTRY_ABI.some((item) => item.name === "applyForBooth"));
  assert.ok(REMITTANCE_ESCROW_ABI.some((item) => item.name === "createOrder"));
  assert.ok(YIELD_VAULT_ABI.some((item) => item.name === "deposit"));
});

test("encodes RemittanceEscrow createOrder and claimOrder with 6-decimal USDC", () => {
  const pickupCode = "REMIT-8821";
  const pickupHash = keccak256(toBytes(pickupCode));
  const amount = parseUnits("25.5", 6);
  assert.equal(amount, 25_500_000n);

  const createData = encodeFunctionData({
    abi: REMITTANCE_ESCROW_ABI,
    functionName: "createOrder",
    args: [
      "0x1111111111111111111111111111111111111111",
      amount,
      pickupHash,
      86400n,
    ],
  });
  assert.ok(createData.startsWith("0x"));

  const claimData = encodeFunctionData({
    abi: REMITTANCE_ESCROW_ABI,
    functionName: "claimOrder",
    args: [1n, pickupCode],
  });
  assert.ok(claimData.startsWith("0x"));
});
