import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { POST } from "./route.ts";

test("POST /api/webhooks/alchemy rejects invalid HMAC signature", async () => {
  process.env.ALCHEMY_WEBHOOK_SIGNING_KEY = "test-signing-key";
  const req = new Request("http://localhost/api/webhooks/alchemy", {
    method: "POST",
    headers: { "x-alchemy-signature": "0000" },
    body: JSON.stringify({ event: { activity: [] } }),
  });
  const res = await POST(req);
  assert.equal(res.status, 401);
});

test("POST /api/webhooks/alchemy accepts valid HMAC signature when DB is unconfigured", async () => {
  process.env.ALCHEMY_WEBHOOK_SIGNING_KEY = "test-signing-key";
  delete process.env.DATABASE_URL;
  const rawBody = JSON.stringify({ event: { activity: [] } });
  const sig = createHmac("sha256", "test-signing-key").update(rawBody, "utf8").digest("hex");

  const req = new Request("http://localhost/api/webhooks/alchemy", {
    method: "POST",
    headers: { "x-alchemy-signature": sig },
    body: rawBody,
  });
  const res = await POST(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.configured, false);
});
