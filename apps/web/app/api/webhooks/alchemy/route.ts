import { NextResponse } from "next/server.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "../../../../lib/db.ts";

function verifyAlchemySignature(rawBody: string, signature: string | null, signingKey: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", signingKey).update(rawBody, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export async function POST(request: Request) {
  try {
    const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;
    if (!signingKey) {
      return NextResponse.json({ error: "Webhook signing key not configured" }, { status: 500 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-alchemy-signature");
    if (!verifyAlchemySignature(rawBody, signature, signingKey)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ indexed: 0, configured: false });
    }

    const payload = JSON.parse(rawBody);
    const activities = Array.isArray(payload?.event?.activity) ? payload.event.activity : [];
    let indexed = 0;

    for (const act of activities) {
      const txHash = String(act?.hash ?? "");
      const fromAddress = String(act?.fromAddress ?? "").toLowerCase();
      const toAddress = String(act?.toAddress ?? "").toLowerCase();
      const amountUsdc = Number(act?.value ?? 0);
      const blockNumber = act?.blockNum ? parseInt(String(act.blockNum), 16) : null;
      const logId = String(act?.log?.logIndex ?? "0");

      if (!txHash || !fromAddress || !toAddress) continue;
      const id = `${txHash}:${logId}`;

      await db`
        INSERT INTO transactions (id, tx_hash, from_address, to_address, amount_usdc, event_type, block_number)
        VALUES (${id}, ${txHash}, ${fromAddress}, ${toAddress}, ${amountUsdc}, 'transfer', ${blockNumber})
        ON CONFLICT (id) DO NOTHING
      `;
      indexed++;
    }

    return NextResponse.json({ indexed, configured: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
