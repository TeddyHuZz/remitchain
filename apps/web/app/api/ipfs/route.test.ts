import test from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { POST } from "./route.ts";

test("POST /api/ipfs rejects missing or invalid signature", async () => {
  process.env.PINATA_JWT = "test-jwt";
  const req = new Request("http://localhost/api/ipfs", {
    method: "POST",
    body: JSON.stringify({ address: "0x123", signature: "0xbad", timestamp: Date.now() }),
  });
  const res = await POST(req);
  assert.equal(res.status, 401);
});

test("POST /api/ipfs rejects expired timestamp", async () => {
  process.env.PINATA_JWT = "test-jwt";
  const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );
  const expiredTs = Date.now() - 10 * 60 * 1000;
  const signature = await account.signMessage({
    message: `RemitChain Booth Pin:${account.address.toLowerCase()}:${expiredTs}`,
  });

  const req = new Request("http://localhost/api/ipfs", {
    method: "POST",
    body: JSON.stringify({
      address: account.address,
      signature,
      timestamp: expiredTs,
      metadata: { storeName: "Test Store" },
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 401);
});

test("POST /api/ipfs pins sanitized store metadata without PII", async () => {
  process.env.PINATA_JWT = "test-jwt";
  const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );
  const timestamp = Date.now();
  const signature = await account.signMessage({
    message: `RemitChain Booth Pin:${account.address.toLowerCase()}:${timestamp}`,
  });

  let pinnedBody: Record<string, unknown> | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    pinnedBody = JSON.parse(String(init?.body ?? "{}"));
    return new Response(JSON.stringify({ IpfsHash: "QmMockHash123" }), { status: 200 });
  }) as typeof fetch;

  try {
    const req = new Request("http://localhost/api/ipfs", {
      method: "POST",
      body: JSON.stringify({
        address: account.address,
        signature,
        timestamp,
        metadata: {
          storeName: "Manila Remit",
          ownerName: "Secret Owner",
          email: "secret@example.com",
          address: "128 Rizal Ave",
          coordinates: "14.5995, 120.9842",
          description: "9 AM - 6 PM",
        },
      }),
    });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ipfsHash, "QmMockHash123");

    const content = (pinnedBody as { pinataContent?: Record<string, unknown> } | null)?.pinataContent;
    assert.equal(content?.storeName, "Manila Remit");
    assert.equal(content?.ownerName, undefined);
    assert.equal(content?.email, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
