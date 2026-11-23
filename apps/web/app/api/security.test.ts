import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { GET as getMerchants } from "./merchants/route.ts";
import { POST as postPayout } from "./payouts/route.ts";
import { POST as postPushToken } from "./push-tokens/route.ts";
import { POST as postWebhook } from "./webhooks/alchemy/route.ts";

test("GET /api/merchants rejects unauthenticated request when DB is configured", async () => {
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
  const req = new Request("http://localhost/api/merchants");
  const res = await getMerchants(req);
  assert.equal(res.status, 401);
  delete process.env.DATABASE_URL;
});

test("POST /api/push-tokens rejects missing signature when DB is configured", async () => {
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
  const req = new Request("http://localhost/api/push-tokens", {
    method: "POST",
    body: JSON.stringify({
      walletAddress: "0x1111111111111111111111111111111111111111",
      expoPushToken: "ExponentPushToken[abc123]",
    }),
  });
  const res = await postPushToken(req);
  assert.equal(res.status, 401);
  delete process.env.DATABASE_URL;
});

test("POST /api/payouts rejects invalid txHash format when DB is configured", async () => {
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
  const req = new Request("http://localhost/api/payouts", {
    method: "POST",
    body: JSON.stringify({
      boothAddress: "0x1111111111111111111111111111111111111111",
      orderId: 1,
      amountUsdc: 25,
      txHash: "not-a-valid-hash",
    }),
  });
  const res = await postPayout(req);
  assert.equal(res.status, 400);
  delete process.env.DATABASE_URL;
});

test("POST /api/webhooks/alchemy ignores non-USDC spam token activity", async () => {
  process.env.ALCHEMY_WEBHOOK_SIGNING_KEY = "test-signing-key";
  process.env.NEXT_PUBLIC_USDC_ADDRESS = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  delete process.env.DATABASE_URL;

  const rawBody = JSON.stringify({
    event: {
      activity: [
        {
          hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          fromAddress: "0x1111111111111111111111111111111111111111",
          toAddress: "0x2222222222222222222222222222222222222222",
          value: 999999,
          rawContract: { address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" },
        },
      ],
    },
  });
  const sig = createHmac("sha256", "test-signing-key").update(rawBody, "utf8").digest("hex");
  const req = new Request("http://localhost/api/webhooks/alchemy", {
    method: "POST",
    headers: { "x-alchemy-signature": sig },
    body: rawBody,
  });
  const res = await postWebhook(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.indexed, 0);
});
