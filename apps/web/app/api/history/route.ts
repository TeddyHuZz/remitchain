import { NextResponse } from "next/server.js";
import { isAddress } from "viem";
import { getDb } from "../../../lib/db.ts";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 30;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const entry = rateBuckets.get(clientKey);
  if (!entry || now > entry.resetAt) {
    rateBuckets.set(clientKey, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX_REQUESTS;
}

export async function GET(request: Request) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isRateLimited(clientIp)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ transactions: [], configured: false });
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.toLowerCase();
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const rows = await db`
    SELECT id, tx_hash, from_address, to_address, amount_usdc, event_type, block_number, created_at
    FROM transactions
    WHERE from_address = ${address} OR to_address = ${address}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return NextResponse.json({ transactions: rows, configured: true });
}
